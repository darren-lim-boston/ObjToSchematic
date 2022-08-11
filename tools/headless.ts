import { Mesh } from '../src/mesh';
import { ObjImporter } from '../src/importers/obj_importer';
import { IVoxeliser } from '../src/voxelisers/base-voxeliser';
import { TVoxelOverlapRule, VoxelMesh } from '../src/voxel_mesh';
import { BlockMesh, BlockMeshParams, FallableBehaviour } from '../src/block_mesh';
import { IExporter} from '../src/exporters/base_exporter';
import { Schematic } from '../src/exporters/schematic_exporter';
import { Litematic } from '../src/exporters/litematic_exporter';
import { RayVoxeliser } from '../src/voxelisers/ray-voxeliser';
import { NormalCorrectedRayVoxeliser } from '../src/voxelisers/normal-corrected-ray-voxeliser';
import { TextureFiltering } from '../src/texture';
import { ColourSpace } from '../src/util';
import { log, LogStyle } from './logging';
import { headlessConfig } from './headless-config';
import { VoxeliseParams, VoxeliserFactory } from '../src/voxelisers/voxelisers';
import { Vector3 } from '../src/vector';

void async function main() {
    if (process.env.npm_config_importpath === undefined || process.env.npm_config_exportpath === undefined) {
        console.log('ERROR: must supply importpath and exportpath args (full path)');
        return;
    }
    const importPath = process.env.npm_config_importpath;
    const exportPath = process.env.npm_config_exportpath;
    const desiredWidth = process.env.npm_config_desiredwidth == undefined ?
        headlessConfig.voxelise.voxeliseParams.desiredWidth : Number(process.env.npm_config_desiredwidth);
    const desiredScale = process.env.npm_config_desiredscale == undefined ?
        -1 : Number(process.env.npm_config_desiredscale);
    const parts = process.env.npm_config_parts == undefined ?
        1 : Number(process.env.npm_config_parts);
    console.log('desired width: ' + desiredWidth);
    const mesh = _import({
        absoluteFilePathLoad: importPath,
    });

    for (let i = 0; i < parts; i++) {
        // TODO: allow split by part
        const minPosition = mesh.getMinPoint().divScalar(1524).mulScalar(desiredWidth); // TODO: this is specific to tiles!! size is 1524
        const voxelMesh = _voxelise(mesh, {
            voxeliser: headlessConfig.voxelise.voxeliser === 'ray-based' ? VoxeliserFactory.GetVoxeliser('ray-based') : 
                ((headlessConfig.voxelise.voxeliser === 'bvh-ray') ? VoxeliserFactory.GetVoxeliser('bvh-ray') : new NormalCorrectedRayVoxeliser()),
            voxeliseParams: {
                desiredWidth: desiredWidth,
                desiredScale: desiredScale,
                useMultisampleColouring: headlessConfig.voxelise.voxeliseParams.useMultisampleColouring,
                textureFiltering: headlessConfig.voxelise.voxeliseParams.textureFiltering === 'linear' ? TextureFiltering.Linear : TextureFiltering.Nearest,
                enableAmbientOcclusion: false,
                voxelOverlapRule: headlessConfig.voxelise.voxeliseParams.voxelOverlapRule as TVoxelOverlapRule,
                calculateNeighbours: false,
                parts: parts,
                partIndex: i,
            },
        });
        const blockMesh = _palette(voxelMesh, {
            blockMeshParams: {
                textureAtlas: headlessConfig.palette.blockMeshParams.textureAtlas,
                blockPalette: headlessConfig.palette.blockMeshParams.blockPalette,
                ditheringEnabled: headlessConfig.palette.blockMeshParams.ditheringEnabled,
                colourSpace: headlessConfig.palette.blockMeshParams.colourSpace === 'rgb' ? ColourSpace.RGB : ColourSpace.LAB,
                fallable: headlessConfig.palette.blockMeshParams.fallable as FallableBehaviour,
            },
        });
        if (parts == 1) {
            _export(blockMesh, {
                absoluteFilePathSave: exportPath,
                exporter: headlessConfig.export.exporter === 'schematic' ? new Schematic() : new Litematic(),
                offset: minPosition,
            });
        } else {
            _export(blockMesh, {
                absoluteFilePathSave: exportPath.substring(0, exportPath.lastIndexOf('.')) + '_part' + i + '.schematic',
                exporter: headlessConfig.export.exporter === 'schematic' ? new Schematic() : new Litematic(),
                offset: minPosition,
            });
        }
    }
    log(LogStyle.Success, 'Finished!');
}();

interface ImportParams {
    absoluteFilePathLoad: string;
}

interface ActionVoxeliseParams {
    voxeliser: IVoxeliser;
    voxeliseParams: VoxeliseParams;
}

interface PaletteParams {
    blockMeshParams: BlockMeshParams;
}

interface ExportParams {
    absoluteFilePathSave: string;
    exporter: IExporter;
    offset: Vector3;
}

// TODO: Log status messages
function _import(params: ImportParams): Mesh {
    log(LogStyle.Info, 'Importing... ' + params.absoluteFilePathLoad);
    const importer = new ObjImporter();
    log(LogStyle.Info, '---parsing...');
    importer.parseFile(params.absoluteFilePathLoad);
    log(LogStyle.Info, '---meshifying...');
    const mesh = importer.toMesh();
    log(LogStyle.Info, '---processing...');
    mesh.processMesh();
    return mesh;
}

// TODO: Log status messages
function _voxelise(mesh: Mesh, params: ActionVoxeliseParams): VoxelMesh {
    log(LogStyle.Info, 'Voxelising...');
    const voxeliser: IVoxeliser = params.voxeliser;
    return voxeliser.voxelise(mesh, params.voxeliseParams);
}

// TODO: Log status messages
function _palette(voxelMesh: VoxelMesh, params: PaletteParams): BlockMesh {
    log(LogStyle.Info, 'Assigning blocks...');
    return BlockMesh.createFromVoxelMesh(voxelMesh, params.blockMeshParams);
}

// TODO: Log status messages
function _export(blockMesh: BlockMesh, params: ExportParams) {
    log(LogStyle.Info, 'Exporting...');
    params.exporter.export(blockMesh, params.absoluteFilePathSave, params.offset);
}

import { BlockMesh } from '../block_mesh';
import { ASSERT, RESOURCES_DIR } from '../util';
import { IExporter } from './base_exporter';
import { Vector3 } from '../vector';
import { StatusHandler } from '../status';

import path from 'path';
import fs from 'fs';
import { NBT, TagType, writeUncompressed } from 'prismarine-nbt';
import * as zlib from 'zlib';

export class Schematic extends IExporter {
    private _convertToNBT(blockMesh: BlockMesh, offset: Vector3) {
        const bufferSize = this._sizeVector.x * this._sizeVector.y * this._sizeVector.z;

        const blocksData = Array<number>(bufferSize);
        const metaData = Array<number>(bufferSize);
        const bounds = blockMesh.getVoxelMesh().getBounds();

        const size = bounds.max.copy().sub(bounds.min.copy());
        console.log('SIZE:');
        console.log(size);

        const schematicBlocks: { [blockName: string]: { id: number, meta: number, name: string } } = JSON.parse(
            fs.readFileSync(path.join(RESOURCES_DIR, './block_ids.json'), 'utf8'),
        );

        const blocks = blockMesh.getBlocks();
        const unsupportedBlocks = new Set<string>();
        let numBlocksUnsupported = 0;
        for (const block of blocks) {
            const indexVector = Vector3.sub(block.voxel.position, bounds.min);
            const index = this._getBufferIndex(indexVector, this._sizeVector); // round to nearest integer
            if (block.blockInfo.name in schematicBlocks) {
                const schematicBlock = schematicBlocks[block.blockInfo.name];
                blocksData[index] = new Int8Array([schematicBlock.id])[0];
                metaData[index] = new Int8Array([schematicBlock.meta])[0];
            } else {
                blocksData[index] = 1; // Default to a Stone block
                metaData[index] = 0;
                unsupportedBlocks.add(block.blockInfo.name);
                ++numBlocksUnsupported;
            }
        }

        if (unsupportedBlocks.size > 0) {
            StatusHandler.Get.add(
                'warning',
                `${numBlocksUnsupported} blocks (${unsupportedBlocks.size} unique) are not supported by the .schematic format, Stone block are used in their place. Try using the schematic-friendly palette, or export using .litematica`,
            );
        }

        const minPoint = blockMesh.getVoxelMesh().getMinPoint();

        // console.log('ORIGIN IS (min point vs min bounds):');
        console.log('OFFSET:');
        console.log(offset);
        // console.log(minPoint);
        console.log('BOUNDS');
        console.log(bounds.min);
        console.log(bounds.max);
        console.log('SIZE');
        console.log(bounds.max.copy().sub(minPoint.copy()));

        const nbt: NBT = {
            type: TagType.Compound,
            name: 'Schematic',
            value: {
                WEOffsetX: { type: TagType.Int, value: offset.x },
                WEOffsetY: { type: TagType.Int, value: 0 },
                WEOffsetZ: { type: TagType.Int, value: offset.z },
                Width: { type: TagType.Short, value: this._sizeVector.x },
                Height: { type: TagType.Short, value: this._sizeVector.y },
                Length: { type: TagType.Short, value: this._sizeVector.z },
                Materials: { type: TagType.String, value: 'Alpha' },
                Blocks: { type: TagType.ByteArray, value: blocksData }, // holds the block data, position to material
                Data: { type: TagType.ByteArray, value: metaData },
                Entities: { type: TagType.List, value: { type: TagType.Int, value: Array(0) } },
                TileEntities: { type: TagType.List, value: { type: TagType.Int, value: Array(0) } },
            },
        };

        return nbt;
    }

    roundTo16(val: number): number {
        return 16 * Math.round(val / 16);
    }

    _getBufferIndex(vec: Vector3, sizeVector: Vector3) {
        return (sizeVector.z * sizeVector.x * vec.y) + (sizeVector.x * vec.z) + vec.x;
    }

    getFormatFilter() {
        return {
            name: this.getFormatName(),
            extensions: ['schematic'],
        };
    }

    getFormatName() {
        return 'Schematic';
    }

    getFormatDisclaimer() {
        return 'Schematic files only support pre-1.13 blocks. As a result, all blocks will be exported as Stone. To export the blocks, use the .litematic format with the Litematica mod.';
    }

    getFileExtension(): string {
        return 'schematic';
    }

    public override export(blockMesh: BlockMesh, filePath: string, offset?: Vector3): boolean {
        const bounds = blockMesh.getVoxelMesh()?.getBounds();
        this._sizeVector = Vector3.sub(bounds.max, bounds.min).add(1);

        ASSERT(offset != undefined, 'OFFSET NEEDS TO BE DEFINED');

        const nbt = this._convertToNBT(blockMesh, offset as Vector3);

        const outBuffer = fs.createWriteStream(filePath);
        const newBuffer = writeUncompressed(nbt, 'big');

        zlib.gzip(newBuffer, (err, buffer) => {
            if (!err) {
                outBuffer.write(buffer);
                outBuffer.end();
            }
            return err;
        });

        return false;
    }
}

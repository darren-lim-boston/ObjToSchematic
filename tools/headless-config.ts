export const headlessConfig = {
    import: {
    },
    voxelise: {
        voxeliser: 'ray-based', // 'ray-based' / 'bvh-ray' / 'ncrb'
        voxeliseParams: {
            desiredWidth: 100, // 15, // 5-320 inclusive
            useMultisampleColouring: false,
            textureFiltering: 'nearest', // 'linear' / 'nearest'
            voxelOverlapRule: 'average', // See TVoxelOverlapRule
        },
    },
    palette: {
        blockMeshParams: {
            textureAtlas: 'vanilla', // Must be an atlas name that exists in /resources/atlases
            blockPalette: 'concrete', // Must be a palette name that exists in /resources/palettes
            ditheringEnabled: false,
            colourSpace: 'lab', // 'rgb' / 'lab';
            fallable: 'replace-falling', // 'replace-fallable' / 'place-string';
        },
    },
    export: {
        exporter: 'schematic', // 'schematic' / 'litematic',
    },
};

import { VoxelMesh } from '../voxel_mesh';
import { AppConfig } from '../config';
import { Mesh } from '../mesh';
import { Axes, Ray, rayIntersectTriangle } from '../ray';
import { Triangle, UVTriangle } from '../triangle';
import { Bounds, RGB, UV, LOG } from '../util';
import { Vector3 } from '../vector';
import { IVoxeliser } from './base-voxeliser';
import { VoxeliseParams } from './voxelisers';

const workerpool = require('workerpool');
const pool = workerpool.pool(null, {
    workerType: 'process',
});

/**
 * This voxeliser works by projecting rays onto each triangle
 * on each of the principle angles and testing for intersections
 */
export class RayVoxeliser extends IVoxeliser {
    private _mesh?: Mesh;
    private _voxelMesh?: VoxelMesh;
    private _voxeliseParams?: VoxeliseParams;
    private _scale!: number;
    private _offset!: Vector3;

    protected override _voxelise(mesh: Mesh, voxeliseParams: VoxeliseParams): VoxelMesh {
        this._mesh = mesh;
        this._voxelMesh = new VoxelMesh(voxeliseParams);
        this._voxeliseParams = voxeliseParams;

        // this._scale = (voxeliseParams.desiredHeight - 1) / Mesh.desiredHeight;
        // this._offset = (voxeliseParams.desiredHeight % 2 === 0) ? new Vector3(0.0, 0.5, 0.0) : new Vector3(0.0, 0.0, 0.0);
        const useMesh = mesh.copy(); // TODO: Voxelise without copying mesh, too expensive for dense meshes

        let bounds = useMesh.getBounds();
        const width = Math.abs(bounds.max.x - bounds.min.x);
        console.log('BEFORE SCALING');
        console.log(bounds);
        console.log(bounds.max.copy().sub(bounds.min.copy()).divScalar(1524));
        if (voxeliseParams.desiredScale != -1) {
            useMesh.scaleMesh(voxeliseParams.desiredScale);
            console.log('SCALE IS ' + voxeliseParams.desiredScale);
        } else {
            useMesh.scaleMesh(voxeliseParams.desiredWidth / width);
            console.log('SCALE IS ' + voxeliseParams.desiredWidth / width);
        }
        console.log('AFTER SCALING ');
        bounds = useMesh.getBounds();
        console.log(bounds);
        console.log(bounds.max.copy().sub(bounds.min.copy()).divScalar(1524));
        // useMesh.translateMesh(this._offset);

        let lastUpdate = new Date();
        if (voxeliseParams.parts == 1) {
            for (let triIndex = 0; triIndex < useMesh.getTriangleCount(); ++triIndex) {
                const uvTriangle = useMesh.getUVTriangle(triIndex);
                const material = useMesh.getMaterialByTriangle(triIndex);
                this._voxeliseTri(uvTriangle, material, triIndex);

                const diff = new Date().getTime() - lastUpdate.getTime();
                if (diff >= 10000) {
                    lastUpdate = new Date();
                    LOG('RAY PROGRESS...' + triIndex + '/' + useMesh.getTriangleCount() + 
                    ' (' + ((triIndex + 1) / useMesh.getTriangleCount() * 100) + '%)');
                }
            }
        } else {
            // // clear texture memory before continuing, favoring a lazy loading texture program
            // this._mesh.resetLoadedTextures();
            // // print total parts
            // if (voxeliseParams.partIndex == 0) {
            //     console.log('=================');
            //     console.log('part partitions: (total size: ' + useMesh.getTriangleCount() + ')');
            //     for (let i = 0; i < voxeliseParams.parts; i++) {
            //         const partTriangleCount = Math.floor(useMesh.getTriangleCount() / voxeliseParams.parts);
            //         let end: number;
            //         const begin = partTriangleCount * i;
            //         if (i == voxeliseParams.parts - 1) {
            //             end = useMesh.getTriangleCount();
            //         } else {
            //             end = partTriangleCount * (i + 1);
            //         }
            //         console.log('PART INDEX ' + i);
            //         console.log('RANGES FROM ' + begin + ' TO ' + end + ' (' + (end - begin) + ')');
            //     }
            //     console.log('=================');
            // }
            // // decide what to do based on parts
            // const partTriangleCount = Math.floor(useMesh.getTriangleCount() / voxeliseParams.parts);
            // let end: number;
            // let begin = partTriangleCount * voxeliseParams.partIndex;
            // if (voxeliseParams.partIndex == voxeliseParams.parts - 1) {
            //     end = useMesh.getTriangleCount();
            // } else {
            //     end = partTriangleCount * (voxeliseParams.partIndex + 1);
            //     begin++;
            // }
            // console.log('GOING FROM ' + begin + ' TO ' + end + ' IN TRIINDICES');

            // for (let triIndex = begin; triIndex < end; ++triIndex) {
            //     const uvTriangle = useMesh.getUVTriangle(triIndex);
            //     const material = useMesh.getMaterialByTriangle(triIndex);
            //     this._voxeliseTri(uvTriangle, material, triIndex, begin, end);

            //     const diff = new Date().getTime() - lastUpdate.getTime();
            //     if (diff >= 1000) {
            //         lastUpdate = new Date();
            //         LOG('RAY PROGRESS...' + (triIndex - begin) + '/' + (end - begin) + 
            //         ' (' + ((triIndex - begin + 1) / (end - begin) * 100) + '%)');
            //     }
            // }
        }

        return this._voxelMesh;
    }

    private shuffle(array: Ray[]) {
        let currentIndex = array.length; let  randomIndex;
      
        // While there remain elements to shuffle.
        while (currentIndex != 0) {
            // Pick a remaining element.
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
      
            // And swap it with the current element.
            [array[currentIndex], array[randomIndex]] = [
                array[randomIndex], array[currentIndex]];
        }
      
        return array;
    }

    private findIntersections(rayList: Ray[], triangle: UVTriangle): Vector3[] {
        workerpool.workerEmit({
            status: 'START TO FIND INTERSECTIONS',
        });
        console.log('START TO FIND INTERSECTIONS');
        const positions: Vector3[] = [];
    
        rayList.forEach((ray) => {
            const intersection = rayIntersectTriangle(ray, triangle.v0, triangle.v1, triangle.v2);
            if (intersection) {
                // intersectionCount++;
                // intersections.push(intersection);
                let voxelPosition: Vector3;
                switch (ray.axis) {
                    case Axes.x:
                        voxelPosition = new Vector3(Math.round(intersection.x), intersection.y, intersection.z);
                        break;
                    case Axes.y:
                        voxelPosition = new Vector3(intersection.x, Math.round(intersection.y), intersection.z);
                        break;
                    case Axes.z:
                        voxelPosition = new Vector3(intersection.x, intersection.y, Math.round(intersection.z));
                        break;
                }
    
                positions.push(voxelPosition);
            }
        });
    
        return positions;
    }

    private distributeWorkOnRays(positions: Vector3[], colors: RGB[], rayList: Ray[], triangle: UVTriangle, materialName: string, triIndex: number) {
        const threadCount = 16;

        const raySize = rayList.length;
        const raySizeDivision = Math.floor(raySize / threadCount);
        for (let i = 0; i < threadCount; i++) {
            // ranges are [begin, end)
            const begin = raySizeDivision * i;
            let end;
            if (i == threadCount - 1) {
                end = raySize;
            } else {
                end = raySizeDivision * (i + 1);
            }
            
            console.log('STARTED NEW WORKER ' + begin + ' TO ' + end);

            pool.exec(this.findIntersections, [rayList.slice(begin, end), triangle], {
                on: function(payload: any) {
                    console.log(payload);
                },
            }).then(
                (result: any) => {
                    console.log(result);
                },
            ).catch((error: Error) => {
                console.log(error);
            });

            // threads.add(new Worker('./voxelizer-helper.ts', {
            //     workerData: {
            //         rayList: rayList.slice(begin, end),
            //         triangle: triangle,
            //     },
            // }));
        }

        // threads.forEach((worker) => {
        //     worker.on('error', (err) => { throw err; });
        //     worker.on('online', () => {
        //         console.log('JUST STARTED!');
        //     });
        //     worker.on('exit', (exitCode) => {
        //         threads.delete(worker);
        //         console.log(`thread exiting, ${threads.size} running`);

        //         if (threads.size == 0) {
        //             console.log('done ' + positions.length + ' ' + colors.length);
        //         }
        //     });
        //     worker.on('message', (newPositions) => {
        //         console.log('RECEIVED:');
        //         console.log(newPositions);
        //         newPositions.forEach((position: Vector3) => {
        //             const voxelColour = this.__getVoxelColour(triangle, materialName, position, triIndex);
        //             positions.push(position);
        //             colors.push(voxelColour);
        //         });
        //     });
        // });

        console.log('wAITING FOR THREADS TO FINISH...');
        let startTime = Date.now();
        while (pool.stats()['busyWorkers'] > 0) {
            if (Date.now() - startTime > 1000) {
                console.log(pool.stats());
                startTime = Date.now();
            }
            // setTimeout(() => { console.log('Waiting... ' + threads.size); }, 1000);
        }

        console.log('ADDING VOXELS');
        for (let i = 0; i < positions.length; i++) {
            this._voxelMesh!.addVoxel(positions[i], colors[i]);
        }
    }

    private _voxeliseTri(triangle: UVTriangle, materialName: string, triIndex: number) {
        let rayList = this._generateRays(triangle.v0, triangle.v1, triangle.v2);

        // if rayList is bigger than 100000, then randomly pick some to use as an estimate
        const maxSize = 100000;
        let shouldPrintIntersectionCount = false;
        if (rayList.length > maxSize) {
            shouldPrintIntersectionCount = true;
            // console.log('shuffling array, size was ' + rayList.length);
            // console.log('RAYS FOR');
            // console.log('numpy.array([' + triangle.v0.x + ', ' + triangle.v0.y + ', ' + triangle.v0.z + ']), numpy.array([' + triangle.v1.x + ', ' + triangle.v1.y + ', ' + triangle.v1.z + ']), numpy.array([' + triangle.v2.x + ', ' + triangle.v2.y + ', ' + triangle.v2.z + '])');
            this.shuffle(rayList);
            rayList = rayList.slice(0, rayList.length / 10 * 8);
        }

        const positions: Vector3[] = [];
        const colors: RGB[] = [];

        if (false && rayList.length > 16000) {
            // todo: this does not work; workers do not spawn
            this.distributeWorkOnRays(positions, colors, rayList, triangle, materialName, triIndex);
        } else {
            const intersections: Vector3[] = [];
            const intersectionCount = 0;
            rayList.forEach((ray) => {
                const intersection = rayIntersectTriangle(ray, triangle.v0, triangle.v1, triangle.v2);
                if (intersection) {
                    // intersectionCount++;
                    // intersections.push(intersection);
                    let voxelPosition: Vector3;
                    switch (ray.axis) {
                        case Axes.x:
                            voxelPosition = new Vector3(Math.round(intersection.x), intersection.y, intersection.z);
                            break;
                        case Axes.y:
                            voxelPosition = new Vector3(intersection.x, Math.round(intersection.y), intersection.z);
                            break;
                        case Axes.z:
                            voxelPosition = new Vector3(intersection.x, intersection.y, Math.round(intersection.z));
                            break;
                    }

                    let voxelColour: RGB;
                    if (this._voxeliseParams!.useMultisampleColouring) {
                        const samples: RGB[] = [];
                        for (let i = 0; i < AppConfig.MULTISAMPLE_COUNT; ++i) {
                            const samplePosition = Vector3.add(voxelPosition, Vector3.random().add(-0.5));
                            samples.push(this.__getVoxelColour(triangle, materialName, samplePosition, triIndex));
                        }
                        voxelColour = RGB.averageFrom(samples);
                    } else {
                        voxelColour = this.__getVoxelColour(triangle, materialName, voxelPosition, triIndex);
                    }

                    this._voxelMesh!.addVoxel(voxelPosition, voxelColour);
                }
            });
        }
    }

    private _compareTo(a: number, b: number): number {
        if (a < b) {
            return -1;
        } else if (a > b) {
            return 1;
        }
        return 0;
    }

    // TODO: Remove
    private __getVoxelColour(triangle: UVTriangle, materialName: string, location: Vector3, triIndex: number): RGB {
        const area01 = new Triangle(triangle.v0, triangle.v1, location).getArea();
        const area12 = new Triangle(triangle.v1, triangle.v2, location).getArea();
        const area20 = new Triangle(triangle.v2, triangle.v0, location).getArea();
        const total = area01 + area12 + area20;

        const w0 = area12 / total;
        const w1 = area20 / total;
        const w2 = area01 / total;

        const uv = new UV(
            triangle.uv0.u * w0 + triangle.uv1.u * w1 + triangle.uv2.u * w2,
            triangle.uv0.v * w0 + triangle.uv1.v * w1 + triangle.uv2.v * w2,
        );
        
        return this._mesh!.sampleMaterial(materialName, uv, this._voxeliseParams!.textureFiltering, triIndex);
    }

    private _generateRays(v0: Vector3, v1: Vector3, v2: Vector3, print=false): Array<Ray> {
        const bounds: Bounds = new Bounds(
            new Vector3(
                Math.floor(Math.min(v0.x, v1.x, v2.x)),
                Math.floor(Math.min(v0.y, v1.y, v2.y)),
                Math.floor(Math.min(v0.z, v1.z, v2.z)),
            ),
            new Vector3(
                Math.ceil(Math.max(v0.x, v1.x, v2.x)),
                Math.ceil(Math.max(v0.y, v1.y, v2.y)),
                Math.ceil(Math.max(v0.z, v1.z, v2.z)),
            ),
        );
    
        const rayList: Array<Ray> = [];
        this._traverseX(rayList, bounds);
        this._traverseY(rayList, bounds);
        this._traverseZ(rayList, bounds);
        return rayList;
    }
    
    private _traverseX(rayList: Array<Ray>, bounds: Bounds) {
        for (let y = bounds.min.y; y <= bounds.max.y; ++y) {
            for (let z = bounds.min.z; z <= bounds.max.z; ++z) {
                rayList.push({
                    origin: new Vector3(bounds.min.x - 1, y, z),
                    axis: Axes.x,
                });
            }
        }
    }
    
    private _traverseY(rayList: Array<Ray>, bounds: Bounds) {
        for (let x = bounds.min.x; x <= bounds.max.x; ++x) {
            for (let z = bounds.min.z; z <= bounds.max.z; ++z) {
                rayList.push({
                    origin: new Vector3(x, bounds.min.y - 1, z),
                    axis: Axes.y,
                });
            }
        }
    }
    
    private _traverseZ(rayList: Array<Ray>, bounds: Bounds) {
        for (let x = bounds.min.x; x <= bounds.max.x; ++x) {
            for (let y = bounds.min.y; y <= bounds.max.y; ++y) {
                rayList.push({
                    origin: new Vector3(x, y, bounds.min.z - 1),
                    axis: Axes.z,
                });
            }
        }
    }
}

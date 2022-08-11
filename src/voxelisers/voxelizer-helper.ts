import { Axes, Ray, rayIntersectTriangle } from '../ray';
import { UVTriangle } from '../triangle';
import { Vector3 } from '../vector';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';

function findIntersections(rayList: Ray[], triangle: UVTriangle): Vector3[] {
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


if (isMainThread) {
    console.log('MAIN THREAD!');
    const worker = new Worker(__filename.replace('.ts', '.js'));
    worker.on('message', (value) => {
        console.log('WORKER: ' + value);
    });
} else if (parentPort != null) {
    parentPort.postMessage('hiii');
    console.log('thread start work...!');
    parentPort.postMessage(findIntersections(workerData.rayList, workerData.triangle));       
}

const fs = require('fs');

const content = 'Some content! ' + (parentPort == null);

fs.writeFile('./test.txt', content, (err: Error) => {
    if (err) {
        console.error(err);
    }
    // file written successfully
});

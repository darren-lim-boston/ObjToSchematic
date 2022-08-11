from math import ceil, floor
from multiprocessing import Manager, Pool, Process
from itertools import product
from typing import List
import numpy
import numpy as np

EPSILON = 0.0000001

class Vector3:
    def __init__(self, x: int, y: int, z: int):
        self.x = x
        self.y = y
        self[2] = z

def generateRays(v0, v1, v2):
    minBounds = numpy.array([floor(min(v0[0], v1[0], v2[0])), floor(min(v0[1], v1[1], v2[1])), floor(min(v0[2], v1[2], v2[2]))])
    maxBounds = numpy.array([ceil(max(v0[0], v1[0], v2[0])), ceil(max(v0[1], v1[1], v2[1])), ceil(max(v0[2], v1[2], v2[2]))])
    
    stepCount = 1
    
    origins = []
    axes = []
    # traverse X
    for y in range(minBounds[1], maxBounds[1] + 1):
        for z in range(minBounds[2], maxBounds[2] + 1, stepCount):
            origins.append(numpy.array([minBounds[0] - 1, y, z]))
            axes.append(numpy.array([1, 0, 0]))
    # traverse Y
    for x in range(minBounds[0], maxBounds[0] + 1):
        for z in range(minBounds[2], maxBounds[2] + 1, stepCount):
            origins.append(numpy.array([x, minBounds[1] - 1, z]))
            axes.append(numpy.array([0, 1, 0]))
    # traverse Z
    for x in range(minBounds[0], maxBounds[0] + 1):
        for y in range(minBounds[1], maxBounds[1] + 1, stepCount):
            origins.append(numpy.array([x, y, minBounds[2] - 1]))
            axes.append(numpy.array([0, 0, 1]))
    
    return numpy.array(origins), numpy.array(axes)

def calculateIntersectionThread(intersections, origins, axes, v0, v1, v2):
    # for i in range(len(origins)):
    #     calculateIntersection(intersections, origins[i], axes[i], v0, v1, v2)
    calculateIntersection(intersections, origins, axes, v0, v1, v2)

def calculateIntersectionSingle(origin, axis, v0, v1, v2):
    edge1 = v1 - v0
    edge2 = v2 - v0
    
    h = numpy.cross(axis, edge2)
    a = numpy.dot(edge1, h)
 
    if a > -EPSILON and a < EPSILON:
        print("fail a")
        return
    
    f = 1.0 / a
    s = origin - v0
    u = f * numpy.dot(s, h)
    
    if u < 0 or u > 1:
        print("fail u")
        return
    
    q = numpy.cross(s, edge1)
    v = f * numpy.dot(axis, q)
    
    if v < 0 or u + v > 1:
        print("fail v")
        return
    
    t = f * numpy.dot(edge2, q)
    
    if t > EPSILON:
        print(origin + (t * axis))
        return origin + (t * axis)
    else:
        return "fail t"

def calculateIntersection(intersections, origin, axis, v0, v1, v2):
    edge1 = np.array([v1 - v0])
    edge2 = numpy.repeat(np.array([v2 - v0]), np.shape(origin)[0], axis=0)
    
    h = numpy.cross(axis, edge2)
    a = numpy.dot(edge1, h.T).T


    #  if (a > -EPSILON && a < EPSILON)
    #     return; // Ray is parallel to triangle
    
    a[a == 0] = -1000000000
    
    f = 1.0 / a
    s = origin - v0
    u = (f * np.array([np.diagonal(numpy.dot(s, h.T))]).T).T[0]
    
    # if u < 0 or u > 1:
    #     return
    
    q = numpy.cross(s, edge1)
    v = f * numpy.dot(axis, q.T)
    v = np.diagonal(v)
    
    # if v < 0 or u + v > 1:
    #     return
    
    t = f * numpy.dot(edge2, q.T)
    t = np.diagonal(t)
    
    for i in range(len(t)):
        if (a[i][0] > -EPSILON and a[i][0] < EPSILON):
            # print("skip since a")
            continue
        if a[i][0] == -1000000000:
            continue
        if u[i] < 0 or u[i] > 1:
            # print("skip since u")       
            continue
        if v[i] < 0 or u[i] + v[i] > 1:
            # print("skip since v")
            continue
        
        if t[i] > EPSILON:
            intersection = origin[i,:] + (t[i] * axis[i,:])
            # print(intersection)
            intersections.append(intersection.tolist())
    
def voxelize(v0, v1, v2):
    origins, axes = generateRays(v0, v1, v2)
    
    print("rays count is",len(origins))
    
    with Manager() as manager:
        intersections = manager.list()
        processes = []
        
        threads = int(len(origins) // 512.0)
        print("There are " + str(threads) + " threads")
        
        divide = len(origins) // threads

        while(threads > 0):
            for i in range(min(16, threads)):
                begin = divide * i
                if i > 0:
                    begin += 1
                if i == threads - 1:
                    end = len(origins) - 1
                else:
                    end = divide * (i + 1)
                
                p = Process(target=calculateIntersectionThread, args=(intersections, origins[begin:end+1,:], axes[begin:end+1,:], v0, v1, v2))
                
                p.start()
                processes.append(p)

            joined = 0
            for p in processes:
                joined += 1
                
                p.join()
            
            print("completed", joined)
            threads -= min(16, threads)

        print("FINAL LIST:")
        intersections = list(intersections)
        
        # intersections.sort(key=lambda val: val[2])
        # intersections.sort(key=lambda val: val[1])
        # intersections.sort(key=lambda val: val[0])
        
        # for x, y, z in intersections:
        #     if x == floor(x):
        #         x = floor(x)
        #     if y == floor(y):
        #         y = floor(y)
        #     if z == floor(z):
        #         z = floor(z)
            
        #     if [x, y, z] == [-67, -16, 1556.9157128859586]:
        #         print("MATCH:")
                
        #     print([x, y, z])
        print("TOTAL",len(intersections))

def func(L, x):
    L.append(x*x)

if __name__ == "__main__":
    voxelize(numpy.array([11430.045349000002, -675.8219075000001, -1524.0172734999996]), numpy.array([12192.045349000002, -675.8215325, -2286.0192265000005]), numpy.array([10668.043396, -675.8215325, -2286.0192265000005]))
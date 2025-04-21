// import { Scene, Mesh, Vector3 } from "@babylonjs/core";

// export class Environment {
//     private _scene: Scene;

//     constructor(scene: Scene) {
//         this._scene = scene;
//     }

//     public async load() {
//         var ground = Mesh.CreateBox("ground", 24, this._scene);
//         ground.scaling = new Vector3(1,.02,1);
//     }
// }
import { Scene, MeshBuilder, Vector3, Mesh } from "@babylonjs/core";

export class Environment {
    private _scene: Scene;
    public groundTiles: Mesh[] = [];

    public tileSize: number = 5; 
    public gridSize: number = 10;

    constructor(scene: Scene) {
        this._scene = scene;
    }

    public async load() {
        for (let x = -this.gridSize; x <= this.gridSize; x++) {
            for (let z = -this.gridSize; z <= this.gridSize; z++) {
                const ground = MeshBuilder.CreateBox(`ground_${x}_${z}`, {
                    width: this.tileSize,
                    height: 0.5,
                    depth: this.tileSize
                }, this._scene);
                ground.position = new Vector3(x * this.tileSize, -0.25, z * this.tileSize);
                ground.checkCollisions = true;
                this.groundTiles.push(ground);
            }
        }
    }
}

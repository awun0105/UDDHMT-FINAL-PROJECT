import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import "@babylonjs/loaders/glTF";
import { BoundingBox } from "@babylonjs/core/Culling/boundingBox";
import { Engine, Scene, Vector3, HemisphericLight, Mesh, MeshBuilder, FreeCamera, Color4, StandardMaterial, Color3, PointLight, ShadowGenerator, Quaternion, Matrix } from "@babylonjs/core";
import { AdvancedDynamicTexture, Button, Control } from "@babylonjs/gui";
import { Environment } from "./environment";
import { Player } from "./characterController";
import { PlayerInput } from "./inputController";

enum State { START = 0, GAME = 1, LOSE = 2 }

class App {
    // General Entire Application
    private _scene: Scene;
    private _canvas: HTMLCanvasElement;
    private _engine: Engine;

    //Game State Related
    public assets;
    private _input: PlayerInput;
    private _environment;
    private _player: Player;

    //Scene - related
    private _state: number = 0;
    private _gamescene: Scene;

    constructor() {
        this._canvas = this._createCanvas();

        // initialize babylon scene and engine
        this._engine = new Engine(this._canvas, true);
        this._scene = new Scene(this._engine);

        // hide/show the Inspector
        window.addEventListener("keydown", (ev) => {
            // Shift+Ctrl+Alt+I
            if (ev.shiftKey && ev.ctrlKey && ev.altKey && ev.keyCode === 73) {
                if (this._scene.debugLayer.isVisible()) {
                    this._scene.debugLayer.hide();
                } else {
                    this._scene.debugLayer.show();
                }
            }
        });

        // run the main render loop
        this._main();
    }

    private _createCanvas(): HTMLCanvasElement {

        //create the canvas html element and attach it to the webpage
        this._canvas = document.createElement("canvas");
        this._canvas.style.width = "100%";
        this._canvas.style.height = "100%";
        this._canvas.id = "gameCanvas";
        document.body.appendChild(this._canvas);

        return this._canvas;
    }

    private async _main(): Promise<void> {
        await this._goToStart();

        // Register a render loop to repeatedly render the scene
        this._engine.runRenderLoop(() => {
            switch (this._state) {
                case State.START:
                    this._scene.render();
                    break;
                case State.GAME:
                    this._scene.render();
                    break;
                case State.LOSE:
                    this._scene.render();
                    break;
                default: break;
            }
        });

        //resize if the screen is resized/rotated
        window.addEventListener('resize', () => {
            this._engine.resize();
        });
    }
    private async _goToStart(){
        this._engine.displayLoadingUI();

        this._scene.detachControl();
        let scene = new Scene(this._engine);
        scene.clearColor = new Color4(0,0,0,1);
        let camera = new FreeCamera("camera1", new Vector3(0, 0, 0), scene);
        camera.setTarget(Vector3.Zero());

        //create a fullscreen ui for all of our GUI elements
        const guiMenu = AdvancedDynamicTexture.CreateFullscreenUI("UI");
        guiMenu.idealHeight = 720; //fit our fullscreen ui to this height

        //create a simple button
        const startBtn = Button.CreateSimpleButton("start", "PLAY");
        startBtn.width = 0.2
        startBtn.height = "40px";
        startBtn.color = "white";
        guiMenu.addControl(startBtn);

        //this handles interactions with the start button attached to the scene
        startBtn.onPointerDownObservable.add(() => {
            this._goToGame();
            scene.detachControl(); //observables disabled
        });
        

        //--SCENE FINISHED LOADING--
        await scene.whenReadyAsync();
        this._engine.hideLoadingUI();
        //lastly set the current state to the start state and set the scene to the start scene
        this._scene.dispose();
        this._scene = scene;
        this._state = State.START;
    }

    

    private async _setUpGame() {
        let scene = new Scene(this._engine);
        this._gamescene = scene;
    
        //--CREATE ENVIRONMENT--
        const environment = new Environment(scene);
        this._environment = environment;
        await this._environment.load(); //environment
        await this._loadCharacterAssets(scene);
    }

    private async _loadCharacterAssets(scene){

         async function loadCharacter(){
            //collision mesh
            const outer = MeshBuilder.CreateBox("outer", { width: 2, depth: 1, height: 3 }, scene);
            outer.isVisible = false;
            outer.isPickable = false;
            outer.checkCollisions = true;

            //move origin of box collider to the bottom of the mesh (to match player mesh)
            outer.bakeTransformIntoVertices(Matrix.Translation(0, 1.5, 0))
            
            //for collisions
            // outer.ellipsoid = new Vector3(1, 1.5, 1);
            // outer.ellipsoidOffset = new Vector3(0, 1.5, 0);

            outer.rotationQuaternion = new Quaternion(0, 1, 0, 0); // rotate the player mesh 180 since we want to see the back of the player
            
            var box = MeshBuilder.CreateBox("Small1", { width: 0.5, depth: 0.5, height: 0.25, faceColors: [new Color4(0,0,0,1), new Color4(0,0,0,1), new Color4(0,0,0,1), new Color4(0,0,0,1),new Color4(0,0,0,1), new Color4(0,0,0,1)] }, scene);
            box.position.y = 1.5;
            box.position.z = 1;

            var body = Mesh.CreateCylinder("body", 3, 2,2,0,0,scene);
            var bodymtl = new StandardMaterial("red",scene);
            bodymtl.diffuseColor = new Color3(.8,.5,.5);
            body.material = bodymtl;
            body.isPickable = false;
            body.bakeTransformIntoVertices(Matrix.Translation(0, 1.5, 0)); // simulates the imported mesh's origin

            //parent the meshes
            box.parent = body;
            body.parent = outer;

            return {
                mesh: outer as Mesh
            }
        }
        return loadCharacter().then(assets=> {
            this.assets = assets;
        })

    }

    private async _initializeGameAsync(scene): Promise<void> {
        //temporary light to light the entire scene
        var light0 = new HemisphericLight("HemiLight", new Vector3(0, 1, 0), scene);

        const light = new PointLight("sparklight", new Vector3(0, 0, 0), scene);
        light.diffuse = new Color3(0.08627450980392157, 0.10980392156862745, 0.15294117647058825);
        light.intensity = 35;
        light.radius = 1;
    
        const shadowGenerator = new ShadowGenerator(1024, light);
        shadowGenerator.darkness = 0.4;
        
        //Create the player
        this._player = new Player(this.assets, scene, shadowGenerator, this._input, () => {
            this._goToLose(); // truyền callback xử lý lose
        });
        const camera = this._player.activatePlayerCamera();
    }

    private async _goToGame() 
    {
        //--SETUP SCENE--
        this._scene.detachControl();
    
        // KHỞI TẠO LẠI SCENE
        await this._setUpGame();
        let scene = this._gamescene;
        scene.clearColor = new Color4(0.0157, 0.0157, 0.2039);
    
        //--GUI--
        const playerUI = AdvancedDynamicTexture.CreateFullscreenUI("UI");
        scene.detachControl();
    
        const loseBtn = Button.CreateSimpleButton("lose", "LOSE");
        loseBtn.width = 0.2;
        loseBtn.height = "40px";
        loseBtn.color = "white";
        loseBtn.top = "-14px";
        loseBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        playerUI.addControl(loseBtn);
    
        loseBtn.onPointerDownObservable.add(() => {
            this._goToLose();
            scene.detachControl();
        });
    
        //--INPUT--
        this._input = new PlayerInput(scene);
    
        // Load nhân vật
        await this._initializeGameAsync(scene);
    
        //--WHEN READY--
        await scene.whenReadyAsync();
        scene.getMeshByName("outer").position = new Vector3(0, 3, 0);
    
        this._scene.dispose();
        this._scene = scene;
        this._state = State.GAME;
        this._engine.hideLoadingUI();
        this._scene.attachControl();
    
        // === METEOR GAMEPLAY ===
        const self = this;
    
        const playerMesh = this._player.mesh;
        const meteorMaterial = new StandardMaterial("meteorMat", scene);
        meteorMaterial.diffuseColor = new Color3(0.5, 0.2, 0.1);
    
        function spawnMeteor() {
            const diameter = 5;
            const meteor = MeshBuilder.CreateSphere("meteor", { diameter }, scene);
            meteor.material = meteorMaterial;
        
            const tileSize = self._environment.tileSize;
            const gridSize = self._environment.gridSize;
            const spawnRange = tileSize * gridSize;
        
            const x = (Math.random() - 0.5) * 2 * spawnRange;
            const z = (Math.random() - 0.5) * 2 * spawnRange;
            meteor.position = new Vector3(x, 30, z);
        
            scene.registerBeforeRender(() => { //Tốc độ rơi
                meteor.position.y -= 0.4;
        
                // 1. Va chạm người chơi
                const meteorBox = meteor.getBoundingInfo().boundingBox;
                const playerBox = playerMesh.getBoundingInfo().boundingBox;
                if (BoundingBox.Intersects(meteorBox, playerBox)) {
                    console.log("Thiên thạch trúng người chơi!");
                    meteor.dispose();
                    self._goToLose();
                    return;
                }
        
                // 2. Va chạm mặt đất
                if (meteor.position.y <= 0.25) {
                    for (let tile of self._environment.groundTiles) {
                        if (!tile.isEnabled()) continue;
        
                        const tileBox = tile.getBoundingInfo().boundingBox;
                        if (BoundingBox.Intersects(meteorBox, tileBox)) {
                            console.log(`Xuyên thủng đất tại ${tile.name}`);
                            
                            tile.setEnabled(false);
                            const tileRef = tile;
                            setTimeout(() => {
                                if (tileRef && !tileRef.isEnabled()) {
                                    tileRef.setEnabled(true);
                                    console.log(`Phục hồi tile: ${tileRef.name}`);
                                }
                            }, 10000);
                        }
                    }
                    meteor.dispose();
                    return;
                }
        
                // 3. Hủy thiên thạch nếu rơi quá xa
                if (meteor.position.y < -10) {
                    meteor.dispose();
                }
            });
        }
                     
        // Tạo thiên thạch mỗi 0.3 giây
        setInterval(() => {
            if (self._state === State.GAME) {
                spawnMeteor();
            }
        }, 300);
    
        // Nếu nhân vật rơi xuống vực
        window.addEventListener("playerFell", () => {
            self._goToLose();
        });
    }

    private async _goToLose(): Promise<void> {
        this._engine.displayLoadingUI();

        //--SCENE SETUP--
        this._scene.detachControl();
        let scene = new Scene(this._engine);
        scene.clearColor = new Color4(0, 0, 0, 1);
        let camera = new FreeCamera("camera1", new Vector3(0, 0, 0), scene);
        camera.setTarget(Vector3.Zero());

        //--GUI--
        const guiMenu = AdvancedDynamicTexture.CreateFullscreenUI("UI");
        const mainBtn = Button.CreateSimpleButton("mainmenu", "MAIN MENU");
        mainBtn.width = 0.2;
        mainBtn.height = "40px";
        mainBtn.color = "white";
        guiMenu.addControl(mainBtn);
        //this handles interactions with the start button attached to the scene
        mainBtn.onPointerUpObservable.add(() => {
            this._goToStart();
        });

        //--SCENE FINISHED LOADING--
        await scene.whenReadyAsync();
        this._engine.hideLoadingUI(); //when the scene is ready, hide loading
        //lastly set the current state to the lose state and set the scene to the lose scene
        this._scene.dispose();
        this._scene = scene;
        this._state = State.LOSE;
    }
}
new App();
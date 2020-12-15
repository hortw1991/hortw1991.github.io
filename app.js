"use strict";

import * as THREE from 'https://unpkg.com/three@0.120.0/build/three.module.js';


let container;      	        // keeping here for easy access
let scene, camera, renderer;    // Three.js rendering basics.
let ground;                     // Allows finding points via raycaster
let player, target, head, armLeft, armRight, legLeft, legRight;       //player model
//arm transformation variables
let flip = false;
let rotX = 0;
let rotXTheta = 0.01;
let transY = 0;
let transZ = -.005;
let gameover = false;     // Controls the render
let win = false;
let camHelper;
let audio;
let hard;
let score;

// Possible torch spawn locations
let torchLocations = [
    [0, 10],
    [-64,60],
    [50,-7],
    [50,-73],
    [-3,-18],
    [56,-53],
    [28,-59],
    [-25,80],
    [25,59],
    [-15,41],
    [-90,68],
    [55,8],
    [-25,-45]
]

// Possible end locations
let exitLocations = [
    [48,-31],
    [48,-33],
    [-95, -85],
    // Rotate 90 if index 3 -> 6 are picked
    [63, 91],
    [-55,42],
    [-18, -21],
    [40, -79],
]


let torch;                      //torch model (set as a single torch first)
let flameRed, flameYell;
let handle;
let torchLight;

let headBBoxHelper, headBBox;
let walls = [];                 //used for checking wall collisions
let p = []; // holds important points
let endPoint;

let collision = 0;
let cameraControls;
let overview = false;
let mousePos;
let rot = Math.PI / 45;

//used to tell if the game needs to stop or not
let totalTime = 200;
let timeLeft = 1;
//lighting
let ambLight;                   //ambient lighting
let brightness;
let gameStart = false;          // Only starts the timer after the player has moved

// Custom stamina bar - you have limited amount of sprinting
let stamina = 100;


function createWorld(diff)
{
    // Music and set difficulty
    document.getElementById("music").play()
    hard = diff;

    renderer.setClearColor( 0 );  // black background
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(20, window.innerWidth/window.innerHeight, 1, 1000);

    //let light = new THREE.AmbientLight(0x404040)
    ambLight = new THREE.AmbientLight(0x808080, 1);
    scene.add(ambLight);
    //scene.add(new THREE.AmbientLight(0x808080, 1));
    ground = new THREE.Mesh(
        new THREE.PlaneGeometry(200, 200),
        new THREE.MeshLambertMaterial({
            color: "white",
            map: makeTexture("resources/spookyGround1.png")
        })
    );

    ground.rotation.x = -Math.PI/2;
    ground.position.y = -1;
    scene.add(ground);

    player = playerCreation();
    torch = torchCreation();
    //torchClone = torch.clone();

    /* Attach camera to a new 3D mesh to track the player */
    target = new THREE.Object3D;  // Could be used to track/follow the player 

    // Camera distance controls
    if (hard)
        camera.position.set(0, 1.7, 10);
    else 
        camera.position.set(0, 40, 75);

    camera.lookAt( 0, 0, 0 );
    
    camHelper = new THREE.Mesh(
        new THREE.BoxGeometry(2, 2, 2),
        new THREE.MeshBasicMaterial({color: "red"})
    );
    camera.add(camHelper);

    head.add(target);
    head.add(camera);
  
    /* Setup head BBOx for collision detection help */
    headBBoxHelper = new THREE.BoxHelper(head, 'white');
    headBBox = new THREE.Box3().setFromObject(headBBoxHelper);

    createOuterWalls();
    createHorizontalWalls();
    setSpawnPoints();

    for (let i = 0; i < walls.length; i++) walls[i].type = "wall";

    const loader = new THREE.CubeTextureLoader();
    const texture = loader.load([
        'resources/skybox/posx.jpg',
        'resources/skybox/negx.jpg',
        'resources/skybox/posy.jpg',
        'resources/skybox/negy.jpg',
        'resources/skybox/posz.jpg',
        'resources/skybox/negz.jpg',
    ]);
    scene.background = texture;

} // end createWorld


/**
 * Sets up the player's spawn and end location
 */
function setSpawnPoints()
{
    let g = new THREE.BoxGeometry(8, 20, 2);
    let tex = new THREE.TextureLoader().load('./resources/cornentrance.jpg');
    let m = new THREE.MeshBasicMaterial({map:tex})
    endPoint = new THREE.Mesh(g, m);
    scene.add(endPoint);

    // // Non random exit location.
    endPoint.position.z = 20;
    endPoint.type = "end";
    p.push(endPoint);

    // Comment below out for a known exit testing
    let min = 0;
    let max = exitLocations.length;
    let num = Math.floor(Math.random() * (max - min) + min);
    endPoint.position.x = exitLocations[num][0];
    endPoint.position.z = exitLocations[num][1];

    // The last 4 spawn locations of the 7 (3-6) need to be rotated 90 L or R
    if (num >= 3)
    {
        endPoint.rotateY(Math.PI / 2);        
    }


    
    // Rotates the head into any desired angle -> randomize for an extra challenge?
    head.position.x = -18;
    head.position.z = 15;
    head.rotateY(Math.PI); 
    head.material.opacity = 0.5;
    head.material.transparent = true;
}


/**
 * Updates the torch location and the score
 */
function updateTorch()
{
    let min = 0; 
    let max = torchLocations.length;

    let num = Math.floor(Math.random() * (max - min) + min);
    if (num == handle.loc)
    {
        num = (num + 1) % (max);
    }

    console.log(num);
    
    collision++;
    timeLeft += 10;
    handle.loc = num;
    handle.position.x = torchLocations[num][0];
    handle.position.z = torchLocations[num][1];

}
//ambient light slowly goes out
function lightingSystem()
{
    ambLight.intensity = timeLeft/totalTime;
}

/**
 * Adds a boundary wall around the outside
 */
function createOuterWalls()
{
    // Overview for testing purposes
    // changeCamera();
    // Material that the rest are cloned off of
    let g = new THREE.BoxGeometry(40, 20, 1);
    let tex = new THREE.TextureLoader().load('./resources/cornwall.jpg');
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 1);
    let m = new THREE.MeshLambertMaterial( { map: tex} );

    let c1 = new THREE.Mesh(g, m);
    c1.position.z = -20;
    // scene.add(c1);
    // walls.push(c1);

    // Clone all boundaries off that boundary
    let northBoundary = c1.clone();
    northBoundary.position.z = -100;
    northBoundary.scale.x = 5;
    northBoundary.scale.y = 1;
    northBoundary.scale.z = 1;
    scene.add(northBoundary);
    walls.push(northBoundary);

    let southBoundary = northBoundary.clone();
    southBoundary.position.z = 100;
    scene.add(southBoundary);
    walls.push(southBoundary);

    let eastBoundary = northBoundary.clone();
    eastBoundary.position.x = 100;
    eastBoundary.position.z = 0;
    eastBoundary.rotateY(Math.PI/2);
    scene.add(eastBoundary);
    walls.push(eastBoundary);

    let westBoundary = eastBoundary.clone();
    westBoundary.position.x = -100;
    scene.add(westBoundary);
    walls.push(westBoundary)

    let test = c1.clone();
    test.position.z = -85;
    test.position.x = -80;
    scene.add(test);
    walls.push(test);
    let test2 = test.clone();
    // test2.rotateY(Math.PI / 180)
    test.position.z = -86;
    scene.add(test2);
    walls.push(test2);
}


// Creates all non border walls.  These are custom placed, as it turns out
// that completely randomizing them with our self-made collision system can
// create unwinnable situations where the gap is too small to get through.
function createHorizontalWalls()
{
    // Material to clone into all wall shapes
    let v = getWall(); v.rotateY(Math.PI/0);
    v.position.x = -50;
    v.position.z = -85;
    v.scale.x = 3;
    addWall(v);

    let h1 = getWall();
    h1.position.x = -77
    h1.position.z = -72;
    h1.scale.x = 3;
    addWall(h1);

    let h2 = getWall();
    h2.position.x = -56;
    h2.position.z = -57;
    h2.scale.x = 9;
    addWall(h2);

    let h3 = getWall();
    h3.position.x = 33;
    h3.position.z = -85;
    h3.scale.x = 10;
    addWall(h3);
    
    let v1 = getWall(); v1.rotateY(Math.PI/2);
    v1.position.x = -34;
    v1.position.z = -74;
    v1.scale.x = 3;
    addWall(v1);

    let h4 = getWall();
    setWall(h4, 27, -72);
    h4.scale.x = 9;

    let v2 = getWall();
    setWall(v2, 39, -31, true)
    v2.scale.x = 11

    let h5 = getWall();
    setWall(h5, 23, -30); 
    h5.scale.x = 15;

    let v3 = getWall();
    setWall(v3, 69, -53, true);
    v3.scale.x = 1.5;

    let v4 = getWall();
    setWall(v4, 14, -55, true);
    v4.scale.x = 3;

    let v5 = getWall();
    setWall(v5, -78, -25, true);
    v5.scale.x = 4.5;
    
    let v6 = getWall();
    setWall(v6, -18, -13, true);
    v6.scale.x = 3

    let v7 = getWall();
    setWall(v7, -38, -30, true);
    v7.scale.x = 2;

    let h6 = getWall();
    setWall(h6, 59, 80);
    h6.scale.x = 5;

    let h7 = getWall();
    setWall(h7, -55, 51);
    h7.scale.x = 6;

    let h8 = getWall();
    setWall(h8, -18, -9);
    h8.scale.x = 8;

    let v9 = getWall();
    setWall(v9, -54, 50, true);
    v9.scale.x = 7;

    let v10 = getWall();
    setWall(v10, 69, 26, true);
    v10.scale.x = 5;

    let v11 = getWall();
    setWall(v11, 9, 40, true);
    v11.scale.x = 8;

    let h9 = getWall();
    setWall(h9, -23, 29);
    h9.scale.x = 4;

    let h10 = getWall();
    setWall(h10, -77, 34);
    h10.scale.x = 4.5;

    let v12 = getWall();
    setWall(v12, -77, 67, true);
    v12.scale.x = 3;

    let h11 = getWall();
    setWall(h11, 9, 65);
    h11.scale.x = 4;

    let v13 = getWall();
    setWall(v13, -34, 73, true);
    v13.scale.x = 2;

    let v14 = getWall();
    setWall(v14, 61, 89, true);
    v14.scale.x = 2;

    let h12 = getWall();
    setWall(h12, 60, -14);
    h12.scale.x = 4;

    let h13 = getWall();
    setWall(h13, 39, 39);
    h13.scale.x = 3.5;

    let v15 = getWall();
    setWall(v15, 49, 60, true);
    v15.scale.x = 2;

    let h14 = getWall();
    setWall(h14, -78, 17);
    h14.scale.x = 2;
    
}

/**
 * The following 3 functions are helper functions we implemented once it was clear
 * the best way to create a maze in a short amount of time is to hand pick the coordinates
 */
function setWall(w, x, z, rotate=false)
{
    // Set wall to scene with the given coords
    w.position.x = x;
    w.position.z = z;

    // Check for rotation
    if (rotate) w.rotateY(Math.PI/2);

    addWall(w);

}

function getWall()
{
    // Returns a basic wall object
    let g = new THREE.BoxGeometry(10, 20, 3);
    // let m = new THREE.MeshBasicMaterial( {color: 0x00ff00} )
    let tex = new THREE.TextureLoader().load('./resources/compress_cornwall2.jpg');
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 2);
    let m = new THREE.MeshLambertMaterial( { map: tex } );
    
    return new THREE.Mesh(g, m);
}


function addWall(wall)
{
    // Adds the wall to the scene and the array holding the walls
    scene.add(wall);
    walls.push(wall);
}


/**
 * This is the function used to create the player model
 */
function playerCreation()
{
    //player head
    const headWidth = 2;
    const headHeight = 2;
    const headDepth = 2;
    const headGeometry = new THREE.BoxGeometry( headWidth, headHeight, headDepth);

    const headMaterial = new THREE.MeshPhongMaterial ( {color: 0xDB1E62} );

    head = new THREE.Mesh(headGeometry, headMaterial);
    scene.add(head);    
    head.position.y = 7;

    //player body
    const bodyWidth = 3;
    const bodyHeight = 4;
    const bodyDepth = 1;

    const bodyGeometry = new THREE.BoxGeometry( bodyWidth, bodyHeight, bodyDepth );
    const bodyMaterial = new THREE.MeshPhongMaterial ( {color: 0xDB1E62} );

    let body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    head.add(body);
    body.position.y = -3;

    //arms
    const armWidth = 1;
    const armHeight = 4;
    const armDepth = 1;

    //need double because with the matrix they modify both limbs when adjusting
    //the matrices so we can have control over each individual arm.
    let armRightGeometry = new THREE.BoxGeometry( armWidth, armHeight, armDepth );
    let armRightMaterial = new THREE.MeshPhongMaterial ( {color: 0xDB1E62} );

    let armLeftGeometry = new THREE.BoxGeometry( armWidth, armHeight, armDepth );
    let armLeftMaterial = new THREE.MeshPhongMaterial ( {color: 0xDB1E62} );

    armLeft = new THREE.Mesh(armLeftGeometry, armLeftMaterial);
    armRight = new THREE.Mesh(armRightGeometry, armRightMaterial);

    body.add(armLeft);
    armLeft.position.x = -1.5;
    body.add(armRight);
    armRight.position.x = 1.5;

    //legs
    const legWidth = 1.3;
    const legHeight = 4;
    const legDepth = 1;

    let legGeometry = new THREE.BoxGeometry( legWidth, legHeight, legDepth );
    let legMaterial = new THREE.MeshPhongMaterial ( {color: 0xDB1E62} );

    legLeft = new THREE.Mesh(legGeometry, legMaterial);
    legRight = new THREE.Mesh(legGeometry, legMaterial);

    body.add(legLeft);
    legLeft.position.y = -3;
    legLeft.position.x = 0.75;

    body.add(legRight);
    legRight.position.y = -3;
    legRight.position.x = -0.75;

}//end of playerCreation

function modelMovement()
{
    //rotation x of the right arm
     let armMatrix = new THREE.Matrix4();

if(rotX <= .5 && flip == false) {
   //flipping right
    armMatrix.set(
        1, 0, 0, 0,
        0, Math.cos(-rotXTheta), Math.sin(-rotXTheta), 0,
        0, -1 * (Math.sin(-rotXTheta)), Math.cos(-rotXTheta), 0,
        0, 0, 0, 1
    );

    armRight.geometry.applyMatrix4(armMatrix);
    armRight.geometry.verticesNeedUpdate = true;
    //flipping left
    armMatrix.set(
        1, 0, 0, 0,
        0, Math.cos(rotXTheta), Math.sin(rotXTheta), 0,
        0, -1 * (Math.sin(rotXTheta)), Math.cos(rotXTheta), 0,
        0, 0, 0, 1
    );
    armLeft.geometry.applyMatrix4(armMatrix);
    armLeft.geometry.verticesNeedUpdate = true;

        //now for the translations to appear connected
        //specifically the y and z translations
        armMatrix.set(
            1, 0, 0, 0, //d messes with x translation
            0, 1, 0,transY, //h messes with y translation
            0, 0, 1, transZ, //p messes with z translation
            0, 0,0,1

        );

        armRight.geometry.applyMatrix4(armMatrix);
        armRight.geometry.verticesNeedUpdate = true;

    armMatrix.set(
        1, 0, 0, 0, //d messes with x translation
        0, 1, 0,-transY, //h messes with y translation
        0, 0, 1, -transZ, //p messes with z translation
        0, 0,0,1

    );

    armLeft.geometry.applyMatrix4(armMatrix);
    armLeft.geometry.verticesNeedUpdate = true;
        rotX += rotXTheta;
    if(rotX > .5)
    {
        rotXTheta *= -1;
        transY *= -1;
        transZ *= -1;
        flip = true;

    }
}else if(rotX >= -.5 && flip == true)
{
    armMatrix.set(
        1, 0, 0, 0,
        0, Math.cos(-rotXTheta), Math.sin(-rotXTheta), 0,
        0, -1 * (Math.sin(-rotXTheta)), Math.cos(-rotXTheta), 0,
        0, 0, 0, 1
    );

    armRight.geometry.applyMatrix4(armMatrix);
    armRight.geometry.verticesNeedUpdate = true;

    //flipping left
    armMatrix.set(
        1, 0, 0, 0,
        0, Math.cos(rotXTheta), Math.sin(rotXTheta), 0,
        0, -1 * (Math.sin(rotXTheta)), Math.cos(rotXTheta), 0,
        0, 0, 0, 1
    );
    armLeft.geometry.applyMatrix4(armMatrix);
    armLeft.geometry.verticesNeedUpdate = true;

    //now for the translations to appear connected
    //specifically the y and z translations
    armMatrix.set(
        1, 0, 0, 0, //d messes with x translation
        0, 1, 0,transY, //h messes with y translation
        0, 0, 1, transZ, //p messes with z translation
        0, 0,0,1

    );

    armRight.geometry.applyMatrix4(armMatrix);
    armRight.geometry.verticesNeedUpdate = true;

    armMatrix.set(
        1, 0, 0, 0, //d messes with x translation
        0, 1, 0,-1*(transY), //h messes with y translation
        0, 0, 1, -1*(transZ), //p messes with z translation
        0, 0,0,1

    );

    armLeft.geometry.applyMatrix4(armMatrix);
    armLeft.geometry.verticesNeedUpdate = true;

    rotX += rotXTheta;

    if(rotX < -.5)
    {
        rotXTheta *= -1;
        transY *= -1;
        transZ *= -1;
        flip = false;
        console.log("Flip = "+flip);
    }
}
    //armRight.position.y = .6;
    //armRight.position.z = -1.5;

}

function torchCreation()
{
    const handleWidth = 0.5;
    const handleHeight = 3.5;
    const handleDepth = 0.5;

    const handleGeometry = new THREE.BoxGeometry( handleWidth, handleHeight, handleDepth);
    const handleMaterial = new THREE.MeshPhongMaterial ( {color: 0x6F4E16} );

    handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.type = "torch";
    handle.loc = 0;

    scene.add(handle);
    handle.position.x = -18;
    handle.position.z = 21;
    handle.position.y = 5;

    const cubeWidth = 1;
    const cubeHeight = 1;
    const cubeDepth = 1;

    const flameRedGeometry = new THREE.BoxGeometry( cubeWidth, cubeHeight, cubeDepth);
    const flameYellGeometry = new THREE.BoxGeometry( cubeWidth, cubeHeight, cubeDepth);

    const flameRedMaterial = glowRedShader();

    flameRed = new THREE.Mesh(flameRedGeometry, flameRedMaterial);
    handle.add(flameRed);

    const flameYellMaterial = glowYellowShader();
    flameYell = new THREE.Mesh(flameYellGeometry, flameYellMaterial);
    handle.add(flameYell);

    flameYell.position.y = 1.75;
    flameYell.rotation.y = 3*(Math.PI)/2;
    flameYell.rotation.x = Math.sin(2);
    flameYell.rotation.z = -Math.sin(2);
    flameRed.position.y = 1.75;

    torchLight = new THREE.PointLight(0xFC8704, 0.7, 10, 2);
    torchLight.position.y = 2;
    handle.add(torchLight);

    //doFlameRotation(flameRed);
    //doFlameRotation(flameRed);

    // Create an invisible box around the torch to recognize collision
    // let g = new THREE.BoxGeometry(5, 5, 5);
}


function doFlameRotation(flame)
{
    let theta = 0.01;
    let flameMatrix = new THREE.Matrix4();
    //x rotation
    flameMatrix.set(
        1, 0, 0, 0,
        0, Math.cos(theta), Math.sin(theta), 0,
        0, -1 * (Math.sin(theta)), Math.cos(theta), 0,
        0, 0, 0, 1

    );

    flame.geometry.applyMatrix4(flameMatrix);
    flame.geometry.verticesNeedUpdate = true;
    //y rotation
    flameMatrix.set(
        Math.cos(theta), 0, Math.sin(theta), 0,
        0, 1, 0, 0,
        -1*(Math.sin(theta)), 0, Math.cos(theta), 0,
        0, 0, 0, 1

    );
    flame.geometry.applyMatrix4(flameMatrix);
    flame.geometry.verticesNeedUpdate = true;

}
function glowRedShader()
{
    let     vShader = document.getElementById('vGlow').innerHTML;
    let     fShader = document.getElementById('fGlow').innerHTML;
    let     itemMaterial = new THREE.ShaderMaterial({
        uniforms:
            {

                "c": {type: "f", value: 1.0},
                "p": {type: "f", value: 1.4},
                glowColor:{type: "c", value: new THREE.Color(0xF35A31)},
                vVector:{type: "v3", value: camera.position},

            },

        vertexShader:   vShader,
        fragmentShader: fShader,
        side: THREE.FrontSide,
        blending: THREE.AdditiveBlending,
        transparent: true,

    });

    return itemMaterial;

}

function glowYellowShader()
{
    let     vShader = document.getElementById('vGlow').innerHTML;
    let     fShader = document.getElementById('fGlow').innerHTML;
    let     itemMaterial = new THREE.ShaderMaterial({
        uniforms:
            {

                "c": {type: "f", value: 1.0},
                "p": {type: "f", value: 1.4},
                glowColor:{type: "c", value: new THREE.Color(0xE2EF17)},
                vVector:{type: "v3", value: camera.position},

            },

        vertexShader:   vShader,
        fragmentShader: fShader,
        side: THREE.FrontSide,
        blending: THREE.AdditiveBlending,
        transparent: true,

    });

    return itemMaterial;

}
/**
 * Checks for collisions against the walls of the maze by preventing movements
 * into walls.  If any collisions are detected from 0.5 z in FRONT of the head,
 * it returns true and the movement key will automatically "bounce" the player
 * in the opposite direction. 
 * 
 * Note: we need to check as if the player has already moved to prevent clipping
 *       INTO the wall by adding one to the length of the ray angle 
 */
function checkWallCollisions(sprint=0)
{
    // Amount forward to predict.  Normal walking is 1, but sprinting is 2
    let predictAmt = sprint || 1;
    console.log("Sprint: " , sprint, predictAmt);

    // Create the head pos and "predict" its next location
    let headPos = head.position.clone();

    // Loop through the head's vertices -> also covers backwards movement prediction
    for (let i = 0; i < head.geometry.vertices.length; i++)
    {
        // Create the raycasting angles and the raycaster
        let localPos = head.geometry.vertices[i].clone();
        let globalAngle = localPos.applyMatrix4(head.matrix);
        let rayAngle = globalAngle.sub(head.position);

        // Get any collisions
        let raycaster = new THREE.Raycaster(headPos, rayAngle.clone().normalize());
        let collisions = raycaster.intersectObjects(scene.children);

        // Check if the the collision is TOUCHING the actual wall (or less)
        if (collisions.length > 0)
        {
            if (collisions[0].distance < rayAngle.length() + predictAmt)
            {
                if (collisions[0].object.type == "wall")
                {
                    console.log(head.x, head.z);
                    return true;
                }
                // Gameover screen
                else if (collisions[0].object.type == "end")
                {
                    console.log("end");
                    // gameOverWin();
                    gameover = true;
                    win = true;
                }
                else if (collisions[0].object.type == "torch")
                {
                    console.log("torch")
                    updateTorch();
                }
            }
        }
    }
}


function checkCameraRot(rot)
{
    let camPos = camHelper.rotateY(rot).position.clone();
    for (let i = 0; i < camHelper.geometry.vertices.length; i++)
    {
        let localPos = camHelper.geometry.vertices[i].clone();
        let globalAngle = localPos.applyMatrix4(head.matrix);
        let rayAngle = globalAngle.sub(camHelper.position);
        let raycaster = new THREE.Raycaster(camPos, rayAngle.clone().normalize());
        let collisions = raycaster.intersectObjects(scene.children);

        if (collisions.length > 0)
        {
            if (collisions[0].distance < rayAngle.length()-1)
            {
                console.log("camlission");
                camera.position.set(0, 1.5, 5);
            }
        } 
        else
        {
            camera.position.set(0, 1.7, 10);
        }
    }
}


/**
 * Displays the game over victory screen with score and option to replay.
 */
function gameOverWin()
{
    let over = document.getElementById('gameover');
    over.style.display = "block";
    over.style.backgroundImage = "url(./resources/endscreen.jpg)";
    over.style.backgroundSize = "100% 100%";

    // Display victor text
    document.getElementById('endmsg').innerHTML = "You escaped...this time."
 
    // Calculate and display score
    let scoreText = document.getElementById('score');
    collision = collision || 1;  // Make sure collisions is at least 1
    score = Math.ceil(timeLeft * (collision));

    if(hard == true)
        score *= 2;

    scoreText.innerHTML = "<strong>Score: <strong>" + score.toString();
}   


/**
 * Displays a super spooky ghost for being too bad to beat the game.
 */
function gameOverLoss()
{
    let over = document.getElementById('gameover');
    over.style.display = "block";
    over.style.backgroundImage = "url(./resources/ghost.jpg)";
    over.style.backgroundSize = "100% 100%";

}



/**
 *  When an animation is in progress, this function is called just before rendering each
 *  frame of the animation.
 */
function updateForFrame()
{
    if (gameStart)
    {
        let time = clock.getElapsedTime(); // time, in seconds, since clock was created
        //let timeFloor = Math.floor(time); //for testing timer going up
        let timeCeiling = Math.ceil(time); //for the count down
        timeLeft = totalTime - timeCeiling
    }

    /**
     * For this section this is where we are going transfer
     * time left in the game/progression to the player
     * so that they can see a count down
     **/

     if(timeLeft >= 0) {
        document.getElementById("timeLeft").innerHTML = "" + timeLeft;
        document.getElementById("collected").innerHTML = "" + collision;
    }
    else{
        document.getElementById("timeLeft").innerHTML = "Lights Out!"; 
        gameover = true;
    }
}

/**
 *  Render the scene.  This is called for each frame of the animation, after updating
 *  the position and velocity data of the balls.
 */
function render()
{
    renderer.render(scene, camera);
}


/**
 *  Creates and returns a Texture object that will read its image from the
 *  specified URL. If the second parameter is provided, the texture will be
 *  applied to the material when the
 */
function makeTexture( imageURL, material )
{
    function callback()
    {
        if (material) {
            material.map = texture;
            material.needsUpdate = true;
        }
        // not necessary to call render() since the scene is continually updating.
    }
    let loader = new THREE.TextureLoader();
    let texture = loader.load(imageURL, callback);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat = new THREE.Vector2(10,10);
    texture.anisotropy = renderer.getMaxAnisotropy();
    return texture;
}

// Shows an overhead for demonstration purposes
function changeCamera() 
{
    if (overview)
    {
        overview = false;
        camera.position.set(0, 5, 80);
        camera.rotation.x = -Math.PI/10; //camera looks down a bit
        camera.lookAt( 0, 3, 0 )
    }
    else
    {
        overview = true;
        camera.position.set(0, 600, 0);
        camera.lookAt(0, 0, 0);
    }
}


//----------------------------- mouse and key support -------------------------------

// Prints mouse click locations in the top down view
function doMouseDown(event)
{
    let mouse = {x: 0, y: 0};
    mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
    mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

    let raycaster = new THREE.Raycaster();
    raycaster.setFromCamera( mouse, camera );
    let point = raycaster.intersectObjects( [ground] );
    for (let i = 0; i < point.length; i++)
    {
        console.log(point[i].point)
    }
}


function doMouseMove(evt)
{
/*
    let fn = "[doMouseMove]: ";
    console.log( fn )    let x = evt.clientX;
    let y = evt.clientY;
    // mouse was moved to (x,y)
    let rotZ = 5*Math.PI/6 * (window.innerWidth/2 - x)/window.innerWidth;
    let rotX = 5*Math.PI/6 * (y - window.innerHeight/2)/window.innerHeight;
    let rcMatrix = new THREE.Matrix4(); // The matrix representing the gun rotation,
    rayVector = new THREE.Vector3(0,1,0);  // Untransformed rayVector
    rayVector.applyMatrix4(rcMatrix);  // Apply the rotation matrix
    ray.geometry.vertices[1].set(rayVector.x*100,rayVector.y*100,rayVector.z*100);
    ray.geometry.verticesNeedUpdate = true;
*/
}


// Decrements stamina (if needed and updates the display)
function decrementStamina()
{
    if (stamina <= 0) return;  // No stam left
    stamina -= 2.5;
    let stam = document.getElementById("stamina");
    stam.innerHTML = stamina.toString();

}

function doKeyDown( event )
{
    // Start the game after assets have loaded and the player can move
    gameStart = true;

    // let fn = "[doKeyDown]: ";
    // console.log( fn + "Key pressed with code " + event.key );
    // https://www.cambiaresearch.com/articles/15/javascript-char-codes-key-codes

    //this will be for movement of player model
    const code = event.key;
    if (timeLeft >= 0)
    {

        // console.log("Key pressed with code " + code);
        if( code === 'a' || code === 'ArrowLeft' )           // 'a' and 'left arrow'
        {
            if (event.shiftKey) 
            {
                if (hard) checkCameraRot(Math.PI/2);
                head.rotateY(Math.PI/2);
            }
            else
            {
                if (hard) checkCameraRot(rot);
                head.rotateY(rot);
            }
        }
        else if( code === 'd' || code === 'ArrowRight' )     // 'd' and 'right arrow'
        {
            if (event.shiftKey) 
            {
                if (hard) checkCameraRot(-Math.PI/2);
                head.rotateY(-Math.PI/2);
            }
            else
            {
                if (hard) checkCameraRot(-rot);
                head.rotateY(-rot);
            }
        }
        /* These alter how close you can get to the maze */
        else if (code == 'w' || code == 'ArrowUp')
        {
            // if (checkWallCollisions(0, 0, -1.50) || checkWallCollisions(1.50, 0, 0) || checkWallCollisions(-1.50, 0, 0))
            if (checkWallCollisions())
            {
                for (let i = 0 ; i < 20; i++)
                {
                    head.translateZ(0.30);
                }
            }
            else 
            {
                if (hard) camera.position.set(0, 1.7, 10);
                head.translateZ(-1.25);
            }
        }
        else if (code == 'q')   // Sprint!  Drains stamina
        {

            // Check if we can sprint and make sure we aren't sprinting into a wall
            if (stamina > 0)
            {
                if (checkWallCollisions(3))
                {
                    for (let i = 0 ; i < 20; i++)
                    {
                        head.translateZ(0.30);
                    }
                }
                else 
                {
                    // See if we can move, and decrement stamina
                    decrementStamina();

                    head.translateZ(-3.0);
                }
            }
            else
            {
                // Could add effects to show we can't sprint
            }
        }
        else if (code == '=') // Demo camera
        {
            changeCamera();
        }
        else if (code =="t" || code == "e") // Demo lighting
        {
            totalTime -= 25;
            lightingSystem();
        }
        else if (code === ",")  // Move exit
        {
            console.log("Moving endpoint");
            endPoint.position.z = 20;
            endPoint.position.x = 0;
            endPoint.rotateY(Math.PI);
        }
        else if (code == 's' || code == 'ArrowDown')
        {    
            if (checkWallCollisions())
            {
                for (let i = 0; i < 20; i++)
                    head.translateZ(-0.30);
            }
            else 
            {
                head.translateZ(1);
             }
        }
    }
}

//--------------------------- animation support -----------------------------------

let clock;  // Keeps track of elapsed time of animation.

function doFrame()
{
    updateForFrame();
    // checkWallCollisions();
    modelMovement();
    doFlameRotation(flameRed);
    doFlameRotation(flameYell);
    lightingSystem();


    render();
    if (!gameover)
    {
        requestAnimationFrame(doFrame);
    } 
    else if (win)
    {
        // gameOverLoss();  // For easy loss testing
        gameOverWin();
    } 
    else
    {
        gameOverLoss();
    }
}

//----------------------- respond to window resizing -------------------------------

/* When the window is resized, we need to adjust the aspect ratio of the camera.
 * We also need to reset the size of the canvas that used by the renderer to
 * match the new size of the window.
 */
function doResize()
{
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix(); // Need to call this for the change in aspect to take effect.
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function createRenderer()
{
    //renderer = new THREE.WebGLRenderer();
    renderer = new THREE.WebGLRenderer( { antialias: true } );
    // we set this according to the div container.
    renderer.setSize( container.clientWidth, container.clientHeight );
    renderer.setClearColor( 0x000000, 1.0 );
    container.appendChild( renderer.domElement );  // adding 'canvas; to container here
    // render, or 'create a still image', of the scene
}

//----------------------------------------------------------------------------------

/**
 *  This init() function is called when by the onload event when the document has loaded.
 */
function init()
{
    container = document.querySelector('#scene-container');

    // Create & Install Renderer ---------------------------------------
    createRenderer();
    mousePos = new THREE.Vector2();


    window.addEventListener( 'resize', doResize );  // Set up handler for resize event
    document.addEventListener("keydown",doKeyDown);
    // document.addEventListener("keyup", doKeyUp);
    window.addEventListener(    "mousedown",doMouseDown );
    window.addEventListener(    "mousemove",doMouseMove );
    document.getElementById('easybtn').addEventListener('click', () => {

        createWorld(false);
        start();

    });
    document.getElementById('hardbtn').addEventListener('click', () => {
        createWorld(true);
        start();
    });

    // Let there be music
    // audio = new Audio('./resources/halloween.mp3');
    // audio.play();

    clock = new THREE.Clock(); // For keeping time during the animation.
    // start();


}

function start()
{
    document.getElementById("start").style.display = "none";
    requestAnimationFrame(doFrame);  // Start the animation.
}
init()


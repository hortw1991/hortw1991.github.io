"use strict";

/**
 * This project uses raycasting to simulate a tank popping balloons as they slowly drop down.  
 * They can't be hit before they're moving, and the laser must be clicked or held down. 
 * It has limited battery.
 */

let container;      	        // keeping here for easy access
let scene, camera, renderer;    // Three.js rendering basics.
let gun;                        // The gun, which can be "aimed" by the mouse.
let gunbase;                    // The cylinder at the base of the gun; the gun is a child of this cylinder.
let ray;                        // A yellow "ray" from the barrel of the gun.
let rayVector;                  // The gun and the ray point from (0,0,0) towards this vector
                                //        (in the local coordinate system of the gunbase).
let gunRotateY = 0;             // Amount by which gun is rotated around the y-axis
                                //    (carrying the camera with it).
let ground;                     // Will becomes the floor.  Needs to be global to check collisions
let gameOver = false;           // Controls the animation timer
let canPop = false;
let battery = 100;

// Our actual raycaster
let raycaster = new THREE.Raycaster(  // Raycaster setup
    new THREE.Vector3(0,0,0), new THREE.Vector3(0,1,0)
);

// Object control
let objects = [];
let hit = null;
let score = 0;      // Global score control

/**
 *  Creates the bouncing balls and the translucent cube in which the balls bounce,
 *  and adds them to the scene.  A light that shines from the direction of the
 *  camera's view is also bundled with the camera and added to the scene.
 */
function createWorld()
{
    renderer.setClearColor( 0 );  // black background
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 1, 1000);

    // Setup shadow
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    /* Add the camera and a light to the scene, linked into one object. */
    let light = new THREE.DirectionalLight();
    light.position.set( 0, 0, 1);
    light.castShadow = true;
    light.shadow.mapSize.width = 512;
    light.shadow.mapSize.height = 512;
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = 500;

    camera.position.set(0, 40, 120);
    camera.rotation.x = -Math.PI/9; //camera looks down a bit
    camera.add(light);
    scene.add(new THREE.DirectionalLight(0x808080));

    ground = new THREE.Mesh(
        new THREE.PlaneGeometry(100, 100),
        new THREE.MeshLambertMaterial({
            color: "white",
            map: makeTexture("resources/wall-grey.jpg")
        })
    );
    ground.rotation.x = -Math.PI/2;
    ground.position.y = -1;
    ground.receiveShadow = true;
    scene.add(ground);

    let gunmat = new THREE.MeshLambertMaterial({
        color: 0xaaaaff
    });
    gun = new THREE.Mesh(new THREE.SphereGeometry(1.5,16,8),gunmat);
    let barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.7,5,16), gunmat);
    barrel.position.y = 2.5;
    gun.add(barrel);
    gunbase = new THREE.Mesh(new THREE.CylinderGeometry(3,3,0.5,32), gunmat);

    let linegeom = new THREE.Geometry();
    linegeom.vertices.push(new THREE.Vector3(0,0,0));
    linegeom.vertices.push(new THREE.Vector3(0,5,0));
    ray = new THREE.Line( linegeom, new THREE.LineBasicMaterial({
        color: 'red',
        linewidth: 3,
        opacity: 0,
        transparent: true,
    }));
    gunbase.add(ray);
    gunbase.add(camera);
    gunbase.add(gun);
    gunbase.castShadow = true;
    gunbase.receiveShadow = false;
    scene.add(gunbase);

    const loader = new THREE.CubeTextureLoader();
    const texture = loader.load([
        'resources/skybox/px.jpg',
        'resources/skybox/nx.jpg',
        'resources/skybox/py.jpg',
        'resources/skybox/ny.jpg',
        'resources/skybox/pz.jpg',
        'resources/skybox/nz.jpg',
    ]);
    scene.background = texture;

    // Object cubes
    for (let x = -30; x <= 30; x += 10) {
        for (let z = -30; z <= 30; z += 10) {
            let m = new THREE.Mesh( new THREE.SphereGeometry(3,6), new THREE.MeshBasicMaterial({color:getColor(), side: THREE.DoubleSide}) );
            m.position.set(x,40,z);
            m.rotation.x = Math.PI/3;
            m.isMoving = false;     // How we will select a random object to move
            m.canMove = true;       // Objects need this so they can go into a death animation of some kind
            m.castShadow = true;    // Not working very well
            m.deleteCounter = 0;    // We want to go over 5 delete rotations before removing it
            objects.push(m);
            scene.add(m);
        }
    }

    

    raycaster = new THREE.Raycaster( new THREE.Vector3(0,0,0), new THREE.Vector3(0,1,0) );
} // end createWorld

/**
 * Creates a random color for our objects.
 */
function getColor()
{   // reduce letter choices for a different palate
    let letters = '0123456789ABCDEF'.split('');
    let color = '#';
    for( let i=0; i<3; i++ )
    {
        color += letters[Math.floor(Math.random() * letters.length)];
    }
    return color;
}

/**
 *  When an animation is in progress, this function is called just before rendering each
 *  frame of the animation.
 */
function updateForFrame()
{
    let hitlist = raycaster.intersectObjects(objects);
    // console.log("hit " + hitlist.length);
    if (hitlist.length !== 0)
    {
        newhit(hitlist[0].object);
    }
    else
    {
        newhit(null);
    }
}

let rot = 0.0;  // Adjust for game difficulty
function newhit(obj) {
    if (obj !== hit) {
        // if (hit != null) {
        //     hit.material.color.set(0xffff00);
        //     hit.material.needsUpdate = true;
        // }

        if (obj != null) {
           for (let i = 0; i < objects.length; i++) {
               if (obj === objects[i] && obj.isMoving && canPop) {
                   console.log("Hit object number " + i);
                   console.log(obj.isMoving);
                   obj.canMove = false;
                   
                   // Make the game more challenging
                   gunRotateY += rot;
                   gunbase.rotation.y = gunRotateY;

                   rot += 0.0;  // Adjust for game scaling difficulty
                   let transformedRayVec = rayVector.clone();
                   gunbase.localToWorld(transformedRayVec);
                   raycaster.set(new THREE.Vector3(0,0,0), transformedRayVec);
           
               }
           }
        }
        hit = obj;
    }
}


function setMoveObject() {
    // Pick a random object and then break out of the loop
    while (1) {
        let makeMove = Math.floor(Math.random() * objects.length);
        if (objects[makeMove].isMoving !== true) {
            objects[makeMove].isMoving = true;
            break;
        }
    }
}


const yDownMatrix = new THREE.Matrix4().makeTranslation(0,-.5,0);
function moveObject() {
    // Moves the cubes down
    for (let i = 0; i < objects.length; i++)
    {
        if (objects[i].isMoving && objects[i].canMove)
        {
            objects[i].applyMatrix4( yDownMatrix );
            // let pos = objects[i].position;
            // console.log(pos)
            // console.log(ground.position)
        }
    }
}


/**
 * Checks for hits.  We will create a nice animation and then delete it
 * after 5 runs.  The score is incremented at the final delete.
 */
function checkHits() {
    for (let i = 0; i < objects.length; i++)
    {
        // Skip item if it can move
        if (!objects[i].canMove)
        {
            objects[i].geometry.scale(.5, .5, .5);
            objects[i].deleteCounter++;
        }
        if (objects[i].deleteCounter === 5)
        {
            scene.remove(objects[i]);
            objects.splice(i, 1);
            score++;
        }
    }
}


/**
 * Checks for cubes that have been hit to increment score and move the object out of the way.
 */
const explodeMatrix = new THREE.Matrix4().makeScale(2, 2, 2);
function successfulHit(obj, i)
{
    obj.canMove = false;
    obj.geometry.scale(.8, .8, .8);
    obj.geometry.scale(.5, .5, .5);
    scene.remove(obj);
    objects.splice(i, 1);
}

/**
 * Checks if any cubes have hit the floor - a loss condition
 */
function checkFloorCollision()
{
    for (let i = 0; i < objects.length; i++)
    {
        if (objects[i].position.y <= 2)
        {
            console.log("Collision");
            gameOver = true;
        }
    }
}


/**
 * Updates the score counter by simply replacing the innerHtml content.
 */
function updateScore()
{
    let remaining = document.getElementById('remaining');
    let destroyed = document.getElementById('destroyed');
    remaining.innerHTML = (objects.length+1).toString();
    destroyed.innerHTML = score.toString();

    if (objects.length === 0) gameOver = true;

}

/**
 * This is controlled by doMouseDown
 */
function decrementBat()
{   
    let bat = document.getElementById('battery');
    battery--;
    console.log(battery);
    bat.innerText = battery.toString();
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


//----------------------------- mouse and key support -------------------------------


/** 
 *  Activates the laser and drains the battery.  Could be adjusted for difficulty.
 */

function doMouseDown(evt)
{
    let fn = "[doMouseDown]: ";
    // console.log( fn );
    if (battery > 0) {
        canPop = true;
        ray.material.transparent = false;

        // Decrement the battery ONLY while held by down
        setInterval(() => {
            decrementBat(); 
        }, 500);
    }

}

function ClearAllIntervals() 
{
    for (var i = 1; i < 99999; i++)
        window.clearInterval(i);
}


/**
 * Stops battery drain, turns of popping, and turns off the laser.  I thought
 * this was cooler than just removing it from the gun and putting it back.
 */
function doMouseUp(evt)
{
    ClearAllIntervals();
    console.log("hello");
    canPop = false;
    ray.material.transparent = true;
}

function doMouseMove(evt)
{
    let fn = "[doMouseMove]: ";
    // console.log( fn );

    let x = evt.clientX;
    let y = evt.clientY;
    // mouse was moved to (x,y)
    let rotZ = 5*Math.PI/6 * (window.innerWidth/2 - x)/window.innerWidth;
    let rotX = 5*Math.PI/6 * (y - window.innerHeight/2)/window.innerHeight;
    gun.rotation.set(rotX,0,rotZ);
    let rcMatrix = new THREE.Matrix4(); // The matrix representing the gun rotation,
                                        //    so we can apply it to the ray direction.
    rcMatrix.makeRotationFromEuler(gun.rotation); // Get the rotation, as a matrix.
    rayVector = new THREE.Vector3(0,1,0);  // Untransformed rayVector
    rayVector.applyMatrix4(rcMatrix);  // Apply the rotation matrix
    ray.geometry.vertices[1].set(rayVector.x*100,rayVector.y*100,rayVector.z*100);
    ray.geometry.verticesNeedUpdate = true;

    // Transformed ray vector code
    let transformedRayVec = rayVector.clone();
    gunbase.localToWorld(transformedRayVec);
    raycaster.set(new THREE.Vector3(0,0,0), transformedRayVec);
}

function doKeyDown( event )
{
    let fn = "[doKeyDown]: ";
    // console.log( fn + "Key pressed with code " + event.key );
    // https://www.cambiaresearch.com/articles/15/javascript-char-codes-key-codes

    const code = event.key;
    // console.log("Key pressed with code " + code);
    let rot = 0;
    if( code === 'a' || code === 'ArrowLeft' )           // 'a' and 'left arrow'
    {
        rot = 0.05;
    }
    else if( code === 'd' || code === 'ArrowRight' )     // 'd' and 'right arrow'
    {
        rot = -0.05;
    }

    if( event.shiftKey )                                  // 'shift'
        rot *= 5;
    if( rot !== 0 )
    {
        gunRotateY += rot;
        gunbase.rotation.y = gunRotateY;

        let transformedRayVec = rayVector.clone();
        gunbase.localToWorld(transformedRayVec);
        raycaster.set(new THREE.Vector3(0,0,0), transformedRayVec);
        event.stopPropagation();          // *** MH
    }
}



//--------------------------- animation support -----------------------------------

let clock;  // Keeps track of elapsed time of animation.
let counter = 0;
function doFrame()
{
    // Choose an object to lower
    counter++;
    if (counter % 100 === 0) // 100
    {
        setMoveObject();
    }

    // Move the object down
    if (counter % 20 === 0) // 20
    {
        moveObject();
    }

    // Check for spheres hitting the floor
    checkFloorCollision();
    checkHits();
    updateForFrame();
    updateScore();
    render();

    // Check for a gameover and do not continue to animate if so.
    if (!gameOver) requestAnimationFrame(doFrame);
    if (gameOver)
    {
        // Pick which overlay depending on winner or loser
        let over;
        if (objects.length == 0)  // win condition
            over = document.getElementById('gameover-win');
        else
            over = document.getElementById('gameover-win');
        over.style.display = "block";
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

//-----------------------------------------------------------------------------------------------
//
// Functions that do not involve direct interaction with the gameloop (ie reset, readme, etc).
//
//-----------------------------------------------------------------------------------------------

/**
 * Shows a readme popup.
 */


/**
 * Functions to restart the game after clearing the objects.
 */
function reload()
{
    location.reload();
}

/**
 *  This init() function is called when by the onload event when the document has loaded.
 */
function init()
{
    container = document.querySelector('#scene-container');

    // Create & Install Renderer ---------------------------------------
    createRenderer();

    window.addEventListener( 'resize', doResize );  // Set up handler for resize event
    document.addEventListener("keydown",doKeyDown);
    window.addEventListener(    "mousedown",doMouseDown );
    window.addEventListener("mouseup", doMouseUp);
    window.addEventListener(    "mousemove",doMouseMove );

    createWorld();

    clock = new THREE.Clock(); // For keeping time during the animation.

    requestAnimationFrame(doFrame);  // Start the animation.

}

init()


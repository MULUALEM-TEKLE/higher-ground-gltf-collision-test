import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import * as CANNON from "cannon-es";
import CannonUtils from "CannonUtils";
import CannonDebugRender from "./utils/CannonDebugRender.js";

import PhysicsHelper from "./utils/PhysicsHelper.js";
import PointerLockControlsCannon from "./utils/PointerControlCannon.js";

let clock = new THREE.Clock();

let scene = new THREE.Scene();
let camera = new THREE.PerspectiveCamera(
	70,
	window.innerWidth / window.innerHeight,
	0.1,
	1000
);
let renderer = new THREE.WebGLRenderer({ antialias: true });
// renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;

document.getElementById("scene").appendChild(renderer.domElement);
renderer.setSize(window.innerWidth, window.innerHeight);
// renderer.setClearColor(0x000);
renderer.setClearColor(0x87ceeb);

// camera.position.set(-10, 40, 10);
// camera.lookAt(0, 0, 0);

//World
let world = new CANNON.World();

world.allowSleep = false;
world.defaultContactMaterial.contactEquationStiffness = 1e9;
world.broadphase = new CANNON.SAPBroadphase(world);
world.defaultContactMaterial.contactEquationRelaxation = 4;

let solver = new CANNON.GSSolver();
solver.iterations = 7;
solver.tolerance = 0.1;
world.solver = new CANNON.SplitSolver(solver);
// uncomment the next line to test the basic solver, less accuracy but better speed
// world.solver = solver;

world.gravity.set(0, -9.82, 0);

// physics material setup
let physicsMaterial = new CANNON.Material("physics");
let physics_physics = new CANNON.ContactMaterial(
	physicsMaterial,
	physicsMaterial,
	{
		friction: 0.125,
		restitution: 0.1,
	}
);
world.addContactMaterial(physics_physics);

let cannonDebugger = new CannonDebugRender(scene, world);

let timeStep = 1 / 60;
let tl = new TimelineMax();

let light = new THREE.SpotLight(0xffffff, 1, 100, Math.PI);
light.shadow.bias = -0.0001;
light.shadow.mapSize.width = 1024 * 4;
light.shadow.mapSize.height = 1024 * 4;
light.castShadow = true;
light.position.set(-10, 50, 30);
scene.add(light);

let ambient = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambient);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(10, 10, 0);
scene.add(directionalLight);

let hemiLight = new THREE.HemisphereLight(0xffeeb1, 0x080820, 1);
scene.add(hemiLight);

function deg(degrees) {
	return degrees * (Math.PI / 180);
}

//Maps
let maps = ["dual_ruins_"]; //changed some stuff on the model in blender, the original file is still there

const loader = new GLTFLoader();

//Random item in array
let mapIndex = maps[Math.floor(Math.random() * maps.length)];

let mapMesh;
let mapBody;
let meshesss = [];
let bodys = [];
let mapLoaded = false;
let mapmeshes;
let colliderPool = [];
let physicsHelper = new PhysicsHelper(world, colliderPool);
let suzzane;

// test model from blender to test collision
loader.load("Assets/misc/suzzane.glb", (gltf) => {
	suzzane = gltf.scene;
	// suzzane.children[0].position.set(10, 20, -20);
	scene.add(suzzane);

	console.log(suzzane.name);
	console.log(suzzane.children[0].name);

	suzzane.children[0].material.castShadow = true;
	suzzane.children[0].material.receiveShadow = true;

	physicsHelper.cannonifyMeshGeometry(
		suzzane.children[0],
		suzzane.children[0].name,
		CANNON.Body.Dynamic,
		physicsMaterial,
		1
	);
});

loader.load(`Assets/Maps/${mapIndex}.glb`, function (gltf) {
	scene.add(gltf.scene);

	let allMeshes = [];
	gltf.scene.traverse((child) => {
		if (child.isMesh) {
			allMeshes.push(child);
			child.material.roughness = 0.85;
			child.castShadow = true;
			child.receiveShadow = true;
			if (child.material.map) child.material.map.anisotropy = 16;
		}
	});

	allMeshes.forEach((child, index) => {
		physicsHelper.cannonifyMeshGeometry(
			child,
			child.name,
			CANNON.Body.STATIC,
			physicsMaterial,
			0
		);
	});

	mapLoaded = true;
});

console.log(colliderPool);

//Ground (updated the ground body instantiation)
let planeGeo = new THREE.PlaneGeometry(150, 150);
let planeMat = new THREE.MeshLambertMaterial({ color: 0x7cfc00 });
let plane = new THREE.Mesh(planeGeo, planeMat);

plane.position.z = 30;
plane.rotation.x = -Math.PI / 2;
scene.add(plane);

const groundShape = new CANNON.Plane();
const groundBody = new CANNON.Body({ mass: 0, material: physicsMaterial });
groundBody.addShape(groundShape);
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(groundBody);

// player collider sphere
const radius = 1.75;
let sphereShape = new CANNON.Sphere(radius);
let sphereBody = new CANNON.Body({
	mass: 50,
	material: physicsMaterial,
	// friction: 0.1,
});
sphereBody.addShape(sphereShape);
sphereBody.position.set(0, 10, 0);
sphereBody.linearDamping = 0.99;
world.addBody(sphereBody);

// test cylinder
const radiusTop = 1.5;
const radiusBottom = 1.5;
const height = 2;
const numSegments = 32;
const cylinderShape = new CANNON.Cylinder(
	radiusTop,
	radiusBottom,
	height,
	numSegments
);
const cylinderBody = new CANNON.Body({
	mass: 1,
	shape: cylinderShape,
	material: physicsMaterial,
});
cylinderBody.position.set(15, 50, -10);
cylinderBody.linearDamping = 0.3;
world.addBody(cylinderBody);

//Weapons

let wscene = new THREE.Scene();
let wcamera = new THREE.PerspectiveCamera(
	70,
	window.innerWidth / window.innerHeight,
	0.1,
	1000
);
let wrenderer = new THREE.WebGLRenderer({ antialias: true });

document.getElementById("weaponsScene").appendChild(wrenderer.domElement);
wrenderer.setSize(window.innerWidth, window.innerHeight);
wrenderer.setClearColor(0x87ceeb, 0);

wcamera.position.set(65, 3, 0);
wcamera.lookAt(0, 0, 0);

let lighting = new THREE.AmbientLight(0xffffff, 1);
wscene.add(lighting);

function wrender() {
	wrenderer.render(wscene, wcamera);
	requestAnimationFrame(wrender);
}

wrender();

let weapons = {
	primary: undefined,
	secondary: undefined,
	melee: undefined,
	explosives: undefined,
	pa: undefined,
	sa: undefined,
};

let ammo = {
	p: 100,
	y: 100,
	r: 100,
	g: 100,
};
//                       0        1       2           3            4          5         6            7
let weaponsData = {
	//Capacity, Reload, AmmoType, Firing Mode, Firing Delay, Damage, Recoil Time, Burst Delay
	primary: {
		Scout: [5, 1.8, "p", "single", 1, 56, 2, 0], //Scout Elite
		Reaper: [2, 3, "p", "single", 0.2, 57, 0, 0], //MP220
		Flamer: [100, 4, "r", "auto", 0.02, 2, 0, 0], //Flamethrower
		Central: [1, 3, "r", "single", 0, 99, 0, 0],
		Sniper: [5, 3, "y", "single", 1.75, 72, 3, 0], //Mosin-Nagant
		RPG: [1, 2, "y", "single", 0, 70, 0, 0],
		Crusher: [20, 2.3, "y", "auto", 0.16, 11, 0, 0], //MP5
		Apollo: [8, 2.7, "y", "single", 0.2, 20, 0, 0], //Carbine
		Rockets: [3, 1.5, "g", "single", 0.3, 30, 0, 0], //Avenger
		Shotty: [2, 2.7, "g", "single", 0.2, 40, 0, 0], //MP220
		Calamity: [10, 4, "g", "burst", 0.35, 17, 0, 0.07], //FAMAS
		Brutality: [2, 3, "g", "single", 1, 80, 0, 0],
	},

	secondary: {
		DEagle: [7, 2.3, "p", "single", 0.16, 35, 0, 0], //DEagle50
		Loner: [30, 2, "p", "burst", 0.35, 15, 0, 0.07], //UMP9
		Grinder: [20, 1.8, "p", "auto", 0.1, 3, 0, 0],
		Pistol: [15, 1.5, "r", "single", 0.12, 12, 0, 0], //M9
		Uzi: [32, 1.8, "r", "auto", 0.045, 9.25, 0, 0], //MAC-10
		Mercury: [13, 3, "y", "auto", 0.06, 15, 0, 0],
	},
};

let currWeapon;
let selectedSlot;

function loadWeapon(name, slot) {
	weapons[slot] = name;
	if (slot == "primary" || slot == "secondary") {
		// weapons[slot.charAt(0) + 'a'] = weaponsData[slot][weapons[slot]][0];
	}

	loader.load(`Assets/Weapons/${name}.glb`, function (glb) {
		glb.scene.traverse((child) => {
			if (child.material) child.material.metalness = 0;
		});

		if (name == "Knife") {
			glb.scene.scale.set(0.04, 0.04, 0.04);
		} else {
			if (name == "Central") {
				glb.scene.scale.set(6, 6, 6);
			} else {
				glb.scene.scale.set(3, 3, 3);
			}
		}

		glb.scene.position.set(63, 2, -2);
		if (name != "Knife") {
			if (name == "DEagle") {
				glb.scene.rotation.set(Math.PI, deg(70), Math.PI);
			} else {
				glb.scene.rotation.set(Math.PI, deg(250), Math.PI);
			}
		}

		if (currWeapon != undefined) {
			wscene.remove(currWeapon);
		}

		currWeapon = glb.scene;
		wscene.add(currWeapon);
	});
}

//Default UI
let primary = document.getElementById("primary");
let secondary = document.getElementById("secondary");
let melee = document.getElementById("melee");
let explosives = document.getElementById("explosives");
let choices = [primary, secondary, melee, explosives];

function selectUI(slot) {
	selectedSlot = slot;
	//Deselect other slots
	for (let i = 0; i < choices.length; i++) {
		choices[i].style.backgroundColor = "rgba(0, 0, 0, 0.2)";
	}

	//Selected slot
	let name =
		weapons[slot.id].charAt(0).toUpperCase() + weapons[slot.id].slice(1);
	slot.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
	slot.children[0].style.marginTop = "3px";
	slot.children[1].innerHTML = `<p>${name}</p>`;
	slot.children[1].style.marginTop = "-15px";
	slot.children[2].innerHTML = `<img src='./Assets/Weapons/Previews/${name.toLowerCase()}.png' />`;

	updateAmmunition(slot.id);
}

function updateAmmunition(slots) {
	if (slots == "primary" || slots == "secondary") {
		document.getElementById("ammoRefills").style.display = "block";
		document.getElementById("ammoLoadedVal").innerHTML =
			weapons[slots.charAt(0) + "a"];
		document.getElementById("ammoRefillsVal").innerHTML =
			ammo[weaponsData[slots][weapons[slots]][2]];
	} else if (slots == "melee") {
		document.getElementById("ammoRefills").style.display = "none";
		document.getElementById("ammoLoadedVal").innerHTML = "∞";
	}
}

function getRandomProperty(obj) {
	return Object.keys(obj)[Math.floor(Math.random() * Object.keys(obj).length)];
}

let prim = getRandomProperty(weaponsData["primary"]);
loadWeapon(prim, "primary");
weapons["pa"] = weaponsData["primary"][prim][0];
selectUI(primary);

let sec = getRandomProperty(weaponsData["secondary"]);
loadWeapon(sec, "secondary");
weapons["sa"] = weaponsData["secondary"][sec][0];
selectUI(secondary);

loadWeapon("Knife", "melee");
selectUI(melee);

//User firing
let fireData;
// let mouseDown = 0; //0 = mouseup, 1 = mousedown
document.addEventListener("mousedown", function (e) {
	if (weapons[selectedSlot.id] in weaponsData["primary"]) {
		fireData = weaponsData["primary"][weapons[selectedSlot.id]];
	} else if (weapons[selectedSlot.id] in weaponsData["secondary"]) {
		fireData = weaponsData["secondary"][weapons[selectedSlot.id]];
	}

	if (e.button == 0) {
		//Shoot
		if (fireData != undefined) {
			if (fireData[3] == "single") {
				if (weapons[selectedSlot.id.charAt(0) + "a"] > 0) {
					weapons[selectedSlot.id.charAt(0) + "a"] -= 1;
					updateAmmunition(selectedSlot.id);
				} else {
					//Reload
				}
			}
		}
	} else if (e.button == 2) {
		//Aim
	}
});

//Controls
const keysPressed = {};

const KEY_UP = "arrowup";
const KEY_LEFT = "arrowleft";
const KEY_DOWN = "arrowdown";
const KEY_RIGHT = "arrowright";
const KEY_W = "w";
const KEY_A = "a";
const KEY_S = "s";
const KEY_D = "d";
const KEY_SHIFT = "shift";

let playerSettings = {
	walk: 0.2,
	sprint: 0.4,
	walkSFX: 1.5,
	sprintSFX: 2,
	sprintValue: 100,
	canSprint: true,
	sprintLoss: 1,
	sprintAdd: 0.25,
	recoil: 0,
};

let walkSound = new Audio("Assets/Audio/walk.mp3");
walkSound.loop = true;

let controls;

let blocker = document.getElementById("blocker");
let instructions = document.getElementById("instructions");
let crosshair = document.getElementById("crosshair");

// controls = new PointerLockControls(camera, document.getElementById("scene"));
controls = new PointerLockControlsCannon(camera, sphereBody, null);

scene.add(controls.getObject());

controls.addEventListener(
	"lock",
	function () {
		instructions.style.display = "none";
		blocker.style.display = "none";
		crosshair.style.display = "block";
		controls.enabled = true;
	},
	false
);

controls.addEventListener(
	"unlock",
	function () {
		blocker.style.display = "block";
		instructions.style.display = "";
		crosshair.style.display = "none";
		controls.enabled = false;
		// walkSound.pause();
	},
	false
);

instructions.addEventListener(
	"click",
	function () {
		controls.lock();
	},
	false
);

function updateControls() {
	if (controls != undefined) {
		if (controls.isLocked) {
			if (
				keysPressed[KEY_SHIFT] &&
				playerSettings["sprintValue"] > 0 &&
				playerSettings["canSprint"]
			) {
				if (keysPressed[KEY_W] || keysPressed[KEY_UP]) {
					controls.moveForward(
						playerSettings["sprint"] - playerSettings["recoil"]
					);
					walkSound.playbackRate = playerSettings["sprintSFX"];
				}

				if (keysPressed[KEY_S] || keysPressed[KEY_DOWN]) {
					controls.moveForward(
						-playerSettings["sprint"] - playerSettings["recoil"]
					);
					walkSound.playbackRate = playerSettings["sprintSFX"];
				}

				if (keysPressed[KEY_D] || keysPressed[KEY_RIGHT]) {
					controls.moveRight(
						playerSettings["sprint"] - playerSettings["recoil"]
					);
					walkSound.playbackRate = playerSettings["sprintSFX"];
				}

				if (keysPressed[KEY_A] || keysPressed[KEY_LEFT]) {
					controls.moveRight(
						-playerSettings["sprint"] - playerSettings["recoil"]
					);
					walkSound.playbackRate = playerSettings["sprintSFX"];
				}

				//Less stamina
				playerSettings["sprintValue"] =
					playerSettings["sprintValue"] - playerSettings["sprintLoss"];
				document.getElementById("stamina").style.backgroundColor = "orange";
			} else {
				if (keysPressed[KEY_W] || keysPressed[KEY_UP]) {
					controls.moveForward(
						playerSettings["walk"] - playerSettings["recoil"]
					);
					walkSound.playbackRate = playerSettings["walkSFX"];
				}

				if (keysPressed[KEY_S] || keysPressed[KEY_DOWN]) {
					controls.moveForward(
						-playerSettings["walk"] - playerSettings["recoil"]
					);
					walkSound.playbackRate = playerSettings["walkSFX"];
				}

				if (keysPressed[KEY_D] || keysPressed[KEY_RIGHT]) {
					controls.moveRight(playerSettings["walk"] - playerSettings["recoil"]);
					walkSound.playbackRate = playerSettings["walkSFX"];
				}

				if (keysPressed[KEY_A] || keysPressed[KEY_LEFT]) {
					controls.moveRight(
						-playerSettings["walk"] - playerSettings["recoil"]
					);
					walkSound.playbackRate = playerSettings["walkSFX"];
				}

				//More stamina
				if (playerSettings["sprintValue"] < 100) {
					playerSettings["sprintValue"] =
						playerSettings["sprintValue"] + playerSettings["sprintAdd"];
					playerSettings["canSprint"] = false;
					document.getElementById("stamina").style.backgroundColor = "orange";
				} else {
					playerSettings["canSprint"] = true;
					document.getElementById("stamina").style.backgroundColor =
						"lightgreen";
				}
			}

			document.getElementById("stamina").style.width =
				playerSettings["sprintValue"] + "px";
		}
	}
}

document.addEventListener(
	"keydown",
	(event) => {
		keysPressed[event.key.toLowerCase()] = true;

		if (
			event.key.toLowerCase() == "w" ||
			event.key.toLowerCase() == "a" ||
			event.key.toLowerCase() == "s" ||
			event.key.toLowerCase() == "d"
		) {
			walkSound.play();
		}

		//Switching
		if (event.key == "1" && weapons["primary"] != undefined) {
			selectUI(primary);
			loadWeapon(weapons["primary"], "primary");
		} else if (event.key == "2" && weapons["secondary"] != undefined) {
			selectUI(secondary);
			loadWeapon(weapons["secondary"], "secondary");
		} else if (event.key == "3" && weapons["melee"] != undefined) {
			selectUI(melee);
			loadWeapon(weapons["melee"], "melee");
		} else if (event.key == "4" && weapons["explosives"] != undefined) {
			selectUI(explosives);
		}
	},
	false
);

document.addEventListener(
	"keyup",
	(event) => {
		keysPressed[event.key.toLowerCase()] = false;

		if (
			event.key.toLowerCase() == "w" ||
			event.key.toLowerCase() == "a" ||
			event.key.toLowerCase() == "s" ||
			event.key.toLowerCase() == "d"
		) {
			walkSound.pause();
		}
	},
	false
);

function updateSuzzane() {
	if (suzzane && colliderPool["Suzanne"]) {
		suzzane.position.x = colliderPool["Suzanne"].position.x;
		suzzane.position.y = colliderPool["Suzanne"].position.y;
		suzzane.position.z = colliderPool["Suzanne"].position.z;

		suzzane.quaternion.copy(colliderPool["Suzanne"].quaternion);
	}
}

//Update
function render() {
	// updateControls();
	updateSuzzane();

	renderer.render(scene, camera);
	controls.update(clock.getDelta());
	if (controls.enabled) world.step(timeStep);
	// cannonDebugger.update();

	requestAnimationFrame(render);

	//Health
	if (document.getElementById("health").offsetWidth < 100) {
		document.getElementById("health").style.backgroundColor = "#FF0000";
	} else if (document.getElementById("health").offsetWidth < 200) {
		document.getElementById("health").style.backgroundColor = "#F74040";
	} else if (document.getElementById("health").offsetWidth < 300) {
		document.getElementById("health").style.backgroundColor = "#FF7777";
	} else if (document.getElementById("health").offsetWidth < 390) {
		document.getElementById("health").style.backgroundColor = "#000000";
	} else {
		document.getElementById("health").style.backgroundColor = "#B3B3B3";
	}

	//Ammo
	document.getElementById("purple").innerHTML = ammo["p"];
	document.getElementById("yellow").innerHTML = ammo["y"];
	document.getElementById("red").innerHTML = ammo["r"];
	document.getElementById("green").innerHTML = ammo["g"];

	//Physics
	if (mapLoaded) {
		for (let i = 0; i < meshesss.length; i++) {
			meshesss[i].position.copy(bodys[i].position);
			meshesss[i].quaternion.copy(bodys[i].quaternion);
		}
	}
}

render();

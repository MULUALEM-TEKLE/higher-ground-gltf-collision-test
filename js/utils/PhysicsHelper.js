import { Vec3, Body } from "cannon-es";
import CannonUtils from "./cannonUtils.js";

export default class PhysicsHelper {
	constructor(world, colliderPool) {
		// this.context = context;
		this.world = world;
		this.colliderPool = colliderPool;
	}

	cannonifyMeshAutoHull(
		meshToBeCanonified,
		hullType,
		bodyType,
		bodyMaterial,
		bodyMass
	) {
		let canonifiedMesh = threeToCannon(meshToBeCanonified, { type: hullType });

		let { shape } = canonifiedMesh;

		let cannonifiedBody = new Body({
			mass: bodyMass,
			type: bodyType,
			shape,
			material: bodyMaterial,
		});

		cannonifiedBody.position.copy(meshToBeCanonified.position);
		cannonifiedBody.quaternion.copy(meshToBeCanonified.quaternion);

		this.world.addBody(cannonifiedBody);
	}

	cannonifyMeshGeometry(
		meshToBeCanonified,
		meshName,
		bodyType,
		bodyMaterial,
		bodyMass,
		scale = new Vec3(1, 1, 1)
	) {
		if (!meshToBeCanonified) {
			console.log(`uh oh the mesh ${meshName} seems to be problematic`);
			return;
		}

		let shape = CannonUtils.CreateTrimesh(meshToBeCanonified.geometry);
		// shape.scale.copy(scale);

		let meshBody = new Body({
			type: bodyType,
			material: bodyMaterial,
			mass: bodyMass,
		});

		this.colliderPool[meshName] = meshBody;

		meshBody.addShape(shape);
		meshBody.position.copy(meshToBeCanonified.position);
		meshBody.quaternion.copy(meshToBeCanonified.quaternion);

		this.world.addBody(meshBody);
	}

	cannonifyMeshWithCustomConvexHull(
		customConvexHullGeometry,
		meshToBeCanonified
	) {
		let shape = CannonUtils.CreateTrimesh(customConvexHullGeometry.geometry);

		let customConvexHullBody = new Body({
			material: this.physicsMaterial,
		});

		customConvexHullBody.addShape(shape);

		customConvexHullBody.position.copy(meshToBeCanonified.position);
		customConvexHullBody.quaternion.set(0, 0, 0, 1);

		this.world.addBody(customConvexHullBody);
	}
}

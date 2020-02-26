import {StoreSchema} from "../src/store-schema";
import {Database} from "../src/database";

describe('#database', () => {

	interface Demo {
		id: number;
		title: string;
		created?: Date;
	}

	const schema: StoreSchema = {
		store: 'demo',
		dbName: 'jest',
		dbVersion: 1,
		indices: [
			{name: 'title'},
			{name: 'created'}
		]
	};

	beforeEach(async (done) => {
		const tx = await new Promise<IDBDatabase>((resolve) => {
			const req = indexedDB.deleteDatabase('jest');
			if (req.transaction) {
				req.transaction.oncomplete = () => resolve(req.result);
			} else {
				req.onsuccess = () => resolve(req.result);
				req.onerror = () =>resolve(req.result);
				req.onupgradeneeded = () => resolve(req.result);
			}
		});
		if (tx) {
			tx.close();
		}
		done();
	});

	describe('#setup', () => {

		it('should initialize', async () => {
			const db = new Database<Demo>('demo', schema);

			expect(await db.awaitInitialized()).toEqual(true);
			expect(db.store).not.toBeUndefined();
		});

		it('should reinitialize successfully', async () => {
			const onUpgradeNeeded = jest.fn();
			const modified = {
				...schema,
				onUpgradeNeeded
			};
			await setupDatabase(modified);

			const db = new Database<Demo>('demo', modified);
			await db.awaitInitialized();

			expect(onUpgradeNeeded).not.toHaveBeenCalled();
		});
	});

	describe('#create', () => {

		it('should create item successfully', async () => {
			await setupDatabase(schema);
			const db = new Database<Demo>('demo', schema);
			expect(await db.awaitInitialized()).toEqual(true);
			const created = new Date();
			const result = await db.create({
				id: 1,
				created,
				title: 'created'
			});
			console.log('created', {
				store: (db as any)._store._rawDatabase.connections
			});
			expect(result).not.toBeUndefined();
			expect(result).toEqual({
				id: 1,
				created,
				title: 'created'
			});
		});

	});

});

async function setupDatabase(schema: StoreSchema): Promise<void> {
	await new Promise<IDBDatabase>((resolve, reject) => {
		const {dbVersion, dbName, indices, keyPath = 'id', store} = schema;
		const req = indexedDB.open(dbName, dbVersion);
		req.onupgradeneeded = () => {
			const str = req.result.createObjectStore(store, {keyPath});
			indices.forEach(({name, keyPath: kp = name, unique = false}) =>
				str.createIndex(name, kp, {unique})
			);
			resolve(req.result);
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = reject;
		if (req.transaction) {
			req.transaction!.oncomplete = () => req.result.close();
		}
	});
}

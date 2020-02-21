import {StoreSchema} from "../src/models";
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
		await new Promise((resolve) => {
			const req = indexedDB.deleteDatabase('jest');
			req.onsuccess = () =>resolve();
			req.onerror = () =>resolve();
			req.onupgradeneeded = () => resolve();
		});
		done();
	});

	describe('#setup', () => {

		it('should initialize', async () => {
			const db = new Database<Demo>('demo', schema);

			expect(await db.awaitInitialized()).toEqual(true);
			expect(db.store).not.toBeUndefined();
			db.store!.close();
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
			db.store!.close();
		});
	});

	describe('#create', () => {

		it('should create item successfully', async () => {
			await setupDatabase(schema);
			const db = new Database<Demo>('demo', schema);
			await db.awaitInitialized();
			const created = new Date();
			const result = await db.create({
				id: 1,
				created,
				title: 'created'
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
	return new Promise<IDBDatabase>((resolve, reject) => {
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
	}).then((db: IDBDatabase) => db.close());
}

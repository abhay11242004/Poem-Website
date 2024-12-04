import postgres from "postgres";
import Poem, { PoemProps} from "../src/models/Poem";
import {
	test,
	describe,
	expect,
	afterEach,
	afterAll,
	beforeEach,
} from "vitest";
import { createUTCDate } from "../src/utils";
import User, { UserProps } from "../src/models/User";


describe("CRUD operations", () => {
	// Set up the connection to the DB.
	const sql = postgres({
		database: "PoemDB",
	});
    const createPoem = async (props: Partial<PoemProps> = {}) => {
		const poemProps: PoemProps = {
			title: props.title || "Test Poem",
			description: props.description || "This is a test poem",
			createdAt: props.createdAt || createUTCDate(),
			userId: props.userId || 1,
		};

		return await Poem.create(sql, poemProps);
	};
	const createUser = async (props: Partial<UserProps> = {}) => {
		return await User.create(sql, {
			email: props.email || "user@email.com",
			password: props.password || "password",
			createdAt: props.createdAt || createUTCDate(),
			isAdmin: props.isAdmin || false, 
		});
	};
	beforeEach(async () => {
		await createUser();
	});

	/**
	 * Clean up the database after each test. This function deletes all the rows
	 * from the todos and subtodos tables and resets the sequence for each table.
	 * @see https://www.postgresql.org/docs/13/sql-altersequence.html
	 */
	afterEach(async () => {
		// Replace the table_name with the name of the table(s) you want to clean up.
		const tables = ["poems", "comments", "users"];

		try {
			for (const table of tables) {
				await sql.unsafe(`DELETE FROM ${table}`);
				await sql.unsafe(
					`ALTER SEQUENCE ${table}_id_seq RESTART WITH 1;`,
				);
			}
		} catch (error) {
			console.error(error);
		}
	});

	 
	afterAll(async () => {
		await sql.end();
	});

    test("Poem was created.", async () => {
		
		const todo = await createPoem({ title: "Test Poem 2" });

		expect(todo.props.title).toBe("Test Poem 2");
		expect(todo.props.description).toBe("This is a test poem");
	});
    test("Poem was retrieved.", async () => {
		
		const poem = await createPoem();

		const readPoem = await Poem.read(sql, poem.props.id!);

		expect(readPoem?.props.title).toBe("Test Poem");
		expect(readPoem?.props.description).toBe("This is a test poem");
	});

	test("Poems were listed.", async () => {
		 
		const poem1 = await createPoem();
		const poem2 = await createPoem();
		const poem3 = await createPoem();

		 
		const poems = await Poem.readAll(sql, 1);

		 
		expect(poems).toBeInstanceOf(Array);
		expect(poems).toContainEqual(poem1);
		expect(poems).toContainEqual(poem2);
		expect(poems).toContainEqual(poem3);
	});

	
	test("Poem was updated.", async () => {
		 
		const poem = await createPoem();

		 
		await poem.update({ title: "Updated Test Poem" });

		 
		const updatedPoem = await Poem.read(sql, poem.props.id!);

		 
		expect(updatedPoem).not.toBeNull();
		expect(updatedPoem?.props.title).toBe("Updated Test Poem");
	});

	test("Poem was deleted.", async () => {
		 
		const poem = await createPoem();

		 
		await poem.delete();

		
		const deletedPoem = await Poem.read(sql, poem.props.id!);

		 
		expect(deletedPoem).toBeNull();
	});
});
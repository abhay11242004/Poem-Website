import postgres from "postgres";
import User, { UserProps } from "../src/models/User";
import {
	test,
	describe,
	expect,
	afterEach,
	afterAll,
	beforeEach,
} from "vitest";
import { createUTCDate } from "../src/utils";

describe("CRUD operations", () => {
	// Set up the connection to the DB.
	const sql = postgres({
		database: "PoemDB",
	});

	beforeEach(async () => {
		// Anything you want to do before each test runs?
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

	// Close the connection to the DB after all tests are done.
	afterAll(async () => {
		await sql.end();
	});
	
	const createUser = async (props: Partial<UserProps> = {}) => {
		return await User.create(sql, {
			email: props.email || "user@email.com",
			password: props.password || "password",
			createdAt: props.createdAt || createUTCDate(),
			isAdmin: props.isAdmin || false, // Uncomment if implementing admin feature.
		});
	}
	test("User was created.", async () => {
		const user = await createUser({ password: "Password123" });

		expect(user.props.email).toBe("user@email.com");
		expect(user.props.password).toBe("Password123");
		expect(user.props.createdAt).toBeTruthy();
		expect(user.props.editedAt).toBeFalsy();
	});

	test("User was not created with duplicate email.", async () => {
		await createUser({ email: "user@email.com" });

		await expect(async () => {
			await createUser({ email: "user@email.com" });
		}).rejects.toThrow("User with this email already exists.");
	});

	test("User was logged in.", async () => {
		const user = await createUser({ password: "Password123" });
		const loggedInUser = await User.login(
			sql,
			user.props.email,
			"Password123",
		);

		expect(loggedInUser?.props.email).toBe("user@email.com");
		expect(loggedInUser?.props.password).toBe("Password123");
	});

	test("User was not logged in with invalid password.", async () => {
		const user = await createUser({ password: "Password123" });

		await expect(async () => {
			await User.login(sql, user.props.email, "wrongpassword");
		}).rejects.toThrow("Invalid credentials.");
	});

	test("User was not logged in with invalid email.", async () => {
		const user = await createUser({ password: "Password123" });

		await expect(async () => {
			await User.login(sql, "invalid@email.com", "password");
		}).rejects.toThrow("Invalid credentials.");
	});

	test("User was not logged in with invalid email and password.", async () => {
		const user = await createUser({ password: "Password123" });

		await expect(async () => {
			await User.login(sql, "invalid@email.com", "wrongpassword");
		}).rejects.toThrow("Invalid credentials.");
	});

	test("Users were listed.", async () => {
		const user1 = await createUser({ email: "user1@email.com" });
		const user2 = await createUser({ email: "user2@email.com" });
		const user3 = await createUser({ email: "user3@email.com" });

		const users = await User.readAll(sql);

		expect(users).toHaveLength(3);
		expect(users[0].props.email).toBe(user1.props.email);
		expect(users[1].props.email).toBe(user2.props.email);
		expect(users[2].props.email).toBe(user3.props.email);
	});

	test("User was made an admin.", async () => {
		const user = await createUser();

		await user.toggleAdmin();

		expect(user.props.isAdmin).toBe(true);
	});

	test("Admin was made a user.", async () => {
		const user = await createUser({ isAdmin: true });

		await user.toggleAdmin();

		expect(user.props.isAdmin).toBe(false);
	});

	test("User was deleted.", async () => {
		const user = await createUser({ password: "Password123" });
		const result = await user.delete();

		expect(result).toBe(true);

		const deletedUser = await User.read(sql, user.props.id!);

		expect(deletedUser).toBeNull();
	});
});

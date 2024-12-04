import postgres from "postgres";
import { StatusCode } from "../src/router/Response";
import { HttpResponse, clearCookieJar, makeHttpRequest } from "./client";
import {
	test,
	describe,
	expect,
	afterEach,
	beforeEach,
} from "vitest";
import User, { UserProps } from "../src/models/User";
import { createUTCDate } from "../src/utils";
import Poem, { PoemProps } from "../src/models/Poem";

describe("HTTP operations", () => {
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
    const login = async (
		email: string = "user@email.com",
		password: string = "password",
	) => {
		await makeHttpRequest("POST", "/login", {
			email,
			password,
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

		await makeHttpRequest("POST", "/logout");
		clearCookieJar();
	});

	test("Homepage was retrieved successfully.", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"GET",
			"/",
		);

		expect(statusCode).toBe(StatusCode.OK);
		expect(Object.keys(body).includes("message")).toBe(true);
		expect(Object.keys(body).includes("payload")).toBe(true);
		expect(body.message).toBe("Homepage!");
	});

	test("Invalid path returned error.", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"GET",
			"/foo",
		);

		expect(statusCode).toBe(StatusCode.NotFound);
		expect(Object.keys(body).includes("message")).toBe(true);
		expect(Object.keys(body).includes("payload")).toBe(false);
		expect(body.message).toBe("Invalid route: GET /foo");
	});
    test("Poem was created.", async () => {
		await login();

		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"POST",
			"/poems",
			{
				title: "Test Poem",
				description: "This is a test poem",
				userId: 1,
			},
		);

		expect(statusCode).toBe(StatusCode.Created);
		expect(Object.keys(body).includes("message")).toBe(true);
		expect(Object.keys(body).includes("payload")).toBe(true);
		expect(body.message).toBe("Poem created successfully!");
		expect(Object.keys(body.payload.poem).includes("id")).toBe(true);
		expect(Object.keys(body.payload.poem).includes("title")).toBe(true);
		expect(Object.keys(body.payload.poem).includes("description")).toBe(
			true,
		);
		expect(body.payload.poem.id).toBe(1);
		expect(body.payload.poem.title).toBe("Test Poem");
		expect(body.payload.poem.description).toBe("This is a test poem");
		expect(body.payload.poem.createdAt).not.toBeNull();
		expect(body.payload.poem.editedAt).toBeNull();
	});

	test("Poem was not created due to missing title.", async () => {
		await login();

		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"POST",
			"/poems",
			{
				description: "This is a test poem",
				userId: 1,
			},
		);

		expect(statusCode).toBe(StatusCode.BadRequest);
		expect(Object.keys(body).includes("message")).toBe(true);
		expect(Object.keys(body).includes("payload")).toBe(true);
		expect(body.message).toBe(
			"Request body must include title and description.",
		);
		expect(body.payload.poem).toBeUndefined();
	});

	test("Poem was not created by unauthenticated user.", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"POST",
			"/poems",
			{
				title: "Test Poem",
				description: "This is a test poem",
				userId: 1,
			},
		);

		expect(statusCode).toBe(StatusCode.Unauthorized);
		expect(body.message).toBe("Unauthorized");
	});

	test("Poem was retrieved.", async () => {
		await login();

		const poem = await createPoem();
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"GET",
			`/poems/${poem.props.id}`,
		);

		expect(statusCode).toBe(StatusCode.OK);
		expect(body.message).toBe("Poem retrieved");
		expect(body.payload.poem.title).toBe(poem.props.title);
		expect(body.payload.poem.description).toBe(poem.props.description);
		expect(body.payload.poem.createdAt).toBe(
			poem.props.createdAt.toISOString(),
		);
		expect(body.payload.poem.editedAt).toBeNull();
	});

	test("Poem was not retrieved due to invalid ID.", async () => {
		await login();

		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"GET",
			"/poems/abc",
		);

		expect(statusCode).toBe(StatusCode.BadRequest);
		expect(body.message).toBe("Invalid ID");
	});

	test("Poem was not retrieved due to non-existent ID.", async () => {
		await login();

		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"GET",
			"/poems/1",
		);

		expect(statusCode).toBe(StatusCode.NotFound);
		expect(body.message).toBe("Not found");
	});

	test("Poem was updated.", async () => {
		await login();

		const poem = await createPoem();
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"PUT",
			`/poems/${poem.props.id}`,
			{
				title: "Updated Test Poem",
			},
		);

		expect(statusCode).toBe(StatusCode.OK);
		expect(body.message).toBe("Poem updated successfully!");
		expect(body.payload.poem.title).toBe("Updated Test Poem");
		expect(body.payload.poem.description).toBe(poem.props.description);
		expect(body.payload.poem.createdAt).toBe(
			poem.props.createdAt.toISOString(),
		);
		expect(body.payload.poem.editedAt).not.toBeNull();
	});

	test("Poem was deleted.", async () => {
		await login();

		const todo = await createPoem();
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"DELETE",
			`/poems/${todo.props.id}`,
		);

		expect(statusCode).toBe(StatusCode.OK);
		expect(body.message).toBe("Poem deleted successfully!");
	});

	test("Poems were listed.", async () => {
		await login();

		const poem1 = await createPoem();
		const poem2 = await createPoem();
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"GET",
			"/poems",
		);

		expect(statusCode).toBe(StatusCode.OK);
		expect(body.message).toBe("Poem list retrieved");
		expect(body.payload.poems).toBeInstanceOf(Array);
		expect(body.payload.poems[0].title).toBe(poem1.props.title);
		expect(body.payload.poems[0].description).toBe(poem1.props.description);
		expect(body.payload.poems[0].createdAt).toBe(
			poem1.props.createdAt.toISOString(),
		);
		expect(body.payload.poems[0].editedAt).toBeNull();
		expect(body.payload.poems[1].title).toBe(poem2.props.title);
		expect(body.payload.poems[1].description).toBe(poem2.props.description);
		expect(body.payload.poems[1].createdAt).toBe(
			poem2.props.createdAt.toISOString(),
		);
		expect(body.payload.poems[1].editedAt).toBeNull();
	});
});
import postgres from "postgres";
import { StatusCode } from "../src/router/Response";
import { HttpResponse, clearCookieJar, makeHttpRequest } from "./client";
import { test, describe, expect, afterEach, beforeEach } from "vitest";
import { createUTCDate } from "../src/utils";
import User, { UserProps } from "../src/models/User";
import Comment, { CommentProps } from "../src/models/Comment";
import Poem, { PoemProps } from "../src/models/Poem";

describe("Comment HTTP operations", () => {
	const sql = postgres({
		database: "PoemDB",
	});

	/**
	 * Helper function to create a Todo with default or provided properties.
	 * @see https://www.typescriptlang.org/docs/handbook/utility-types.html#partialtype
	 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Logical_OR#short-circuit_evaluation
	 * @param props The properties of the Todo.
	 * @default title: "Test Todo"
	 * @default description: "This is a test todo"
	 * @default status: "incomplete"
	 * @default dueAt: A week from today
	 * @default createdAt: The current date/time
	 * @returns A new Todo object that has been persisted in the DB.
	 */


	const createUser = async (props: Partial<UserProps> = {}) => {
		return await User.create(sql, {
			email: props.email || "user@email.com",
			password: props.password || "password",
			createdAt: props.createdAt || createUTCDate(),
			isAdmin: props.isAdmin || false,
		});
	};
    const createPoem = async (props: Partial<PoemProps> = {}) => {
		const poemProps: PoemProps = {
			title: props.title || "Test Poem",
			description: props.description || "This is a test poem",
			createdAt: props.createdAt || createUTCDate(),
			userId: props.userId || 1,
		};

		return await Poem.create(sql, poemProps);
	};
	const createComment = async (props: Partial<CommentProps> = {}) => {
		const commentProps: CommentProps = {
			title: props.title || "Test Comment",
			description: props.description || "This is a test comment",
			createdAt: props.createdAt || createUTCDate(),
			userId: props.userId || 1,
            poemId: props.poemId || 1
		};

		return await Comment.create(sql, commentProps);
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
        await createPoem();
	});

	/**
	 * Clean up the database after each test. This function deletes all the rows
	 * from the todos and subtodos tables and resets the sequence for each table.
	 * @see https://www.postgresql.org/docs/13/sql-altersequence.html
	 */
	afterEach(async () => {
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

	test("Comment was created.", async () => {
		await login();

		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"POST",
			"/poems/1/comments",
			{
				title: "Test Comment",
				description: "This is a test comment",
				userId: 1,
                poemId: 1
			},
		);

		expect(statusCode).toBe(StatusCode.Created);
		expect(Object.keys(body).includes("message")).toBe(true);
		expect(Object.keys(body).includes("payload")).toBe(true);
		expect(body.message).toBe("Comment created successfully!");
		expect(Object.keys(body.payload.comment).includes("id")).toBe(true);
		expect(Object.keys(body.payload.comment).includes("title")).toBe(true);
		expect(Object.keys(body.payload.comment).includes("description")).toBe(
			true,
		);
		expect(body.payload.comment.id).toBe(1);
		expect(body.payload.comment.title).toBe("Test Comment");
		expect(body.payload.comment.description).toBe("This is a test comment");
		expect(body.payload.comment.createdAt).not.toBeNull();
		expect(body.payload.comment.editedAt).toBeNull();
	});

	test("Comment was not created due to missing title.", async () => {
		await login();

		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"POST",
			"/poems/1/comments",
			{
				description: "This is a test comment",
				userId: 1,
                poemId: 1
			},
		);

		expect(statusCode).toBe(StatusCode.BadRequest);
		expect(Object.keys(body).includes("message")).toBe(true);
		expect(Object.keys(body).includes("payload")).toBe(true);
		expect(body.message).toBe(
			"Request body must include title and description.",
		);
		expect(body.payload.todo).toBeUndefined();
	});

	test("Comment was not created by unauthenticated user.", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"POST",
			"/poems/1/comments",
			{
				title: "Test Comment",
				description: "This is a test comment",
				userId: 1,
                poemId: 1
			},
		);

		expect(statusCode).toBe(StatusCode.Unauthorized);
		expect(body.message).toBe("Unauthorized");
	});

	test("Comment was updated.", async () => {
		await login();

		const comment = await createComment();
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"PUT",
			`/poems/1/comments/${comment.props.id}`,
			{
				title: "Updated Test Comment",
			},
		);

		expect(statusCode).toBe(StatusCode.OK);
		expect(body.message).toBe("Comment updated successfully!");
		expect(body.payload.comment.title).toBe("Updated Test Comment");
		expect(body.payload.comment.description).toBe(comment.props.description);
		expect(body.payload.comment.createdAt).toBe(
			comment.props.createdAt.toISOString(),
		);
		expect(body.payload.comment.editedAt).not.toBeNull();
	});

	test("Comment was deleted.", async () => {
		await login();

		const comment = await createComment();
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"DELETE",
			`/poems/1/comments/${comment.props.id}`,
		);

		expect(statusCode).toBe(StatusCode.OK);
		expect(body.message).toBe("Comment deleted successfully!");
	});


	test("Comments were listed.", async () => {
		await login();

		const comment1 = await createComment();
		const comment2 = await createComment();
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"GET",
			"/poems/1",
		);

		expect(statusCode).toBe(StatusCode.OK);
		expect(body.payload.comments).toBeInstanceOf(Array);
		expect(body.payload.comments[0].title).toBe(comment1.props.title);
		expect(body.payload.comments[0].description).toBe(comment1.props.description);
		expect(body.payload.comments[0].createdAt).toBe(
			comment1.props.createdAt.toISOString(),
		);
		expect(body.payload.comments[0].editedAt).toBeNull();
		expect(body.payload.comments[1].title).toBe(comment2.props.title);
		expect(body.payload.comments[1].description).toBe(comment2.props.description);
		expect(body.payload.comments[1].createdAt).toBe(
			comment2.props.createdAt.toISOString(),
		);
		expect(body.payload.comments[1].editedAt).toBeNull();
	});
});
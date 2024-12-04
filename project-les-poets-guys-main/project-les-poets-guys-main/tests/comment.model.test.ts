import postgres from "postgres";
import Comment, { CommentProps } from "../src/models/Comment";
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
import Poem, { PoemProps } from "../src/models/Poem";

describe("CRUD operations", () => {
	// Set up the connection to the DB.
	const sql = postgres({
		database: "PoemDB",
	});
    const createComment = async (props: Partial<CommentProps> = {}) => {
		const commentProps: CommentProps = {
			title: props.title || "Test Comment",
			description: props.description || "This is a test comment",
			createdAt: props.createdAt || createUTCDate(),
			userId: props.userId || 1,
			poemId: props.poemId || 1,
		};

		return await Comment.create(sql, commentProps);
	};
	const createUser = async (props: Partial<UserProps> = {}) => {
		return await User.create(sql, {
			email: props.email || "user@email.com",
			password: props.password || "password",
			createdAt: props.createdAt || createUTCDate(),
			isAdmin: props.isAdmin || false, // Uncomment if implementing admin feature.
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
	beforeEach(async () => {
		await createUser();
		await createPoem();
		await createComment();
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

    test("Comment was created.", async () => {
		
		const comment = await createComment({ title: "Test Comment 2" });

		expect(comment.props.title).toBe("Test Comment 2");
		expect(comment.props.description).toBe("This is a test comment");
	});
    test("Comment was retrieved.", async () => {
		
		const comment = await createComment();

		const readComment = await Comment.read(sql, comment.props.id!);

		expect(readComment?.props.title).toBe("Test Comment");
		expect(readComment?.props.description).toBe("This is a test comment");
	});

	test("Comments were listed.", async () => {
		 
		const comment1 = await createComment();
		const comment2 = await createComment();
		const comment3 = await createComment();

		 
		const comments = await Comment.readAll(sql, 1);

		 
		expect(comments).toBeInstanceOf(Array);
		expect(comments).toContainEqual(comment1);
		expect(comments).toContainEqual(comment2);
		expect(comments).toContainEqual(comment3);
	});

	
	test("Comment was updated.", async () => {
		 
		const comment = await createComment();

		 
		await comment.update({ title: "Updated Test Poem" });

		 
		const updatedComment = await Comment.read(sql, comment.props.id!);

		 
		expect(updatedComment).not.toBeNull();
		expect(updatedComment?.props.title).toBe("Updated Test Poem");
	});

	test("Comment was deleted.", async () => {
		 
		const comment = await createComment();

		 
		await comment.delete();

		
		const deletedComment = await Comment.read(sql, comment.props.id!);

		 
		expect(deletedComment).toBeNull();
	});
});
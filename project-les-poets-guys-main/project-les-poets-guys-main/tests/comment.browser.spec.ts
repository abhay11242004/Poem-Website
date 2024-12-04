import postgres from "postgres";
import { test, expect, Page } from "@playwright/test";
import { getPath } from "../src/url";
import Comment, { CommentProps } from "../src/models/Comment";
import User, { UserProps } from "../src/models/User";
import { createUTCDate } from "../src/utils";
import Poem, { PoemProps } from "../src/models/Poem";

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

const createUser = async (props: Partial<UserProps> = {}) => {
	return await User.create(sql, {
		email: props.email || "user@email.com",
		password: props.password || "password",
		createdAt: props.createdAt || createUTCDate(),
		isAdmin: props.isAdmin || false, // Uncomment if implementing admin feature.
	});
};

const login = async (
	page: Page,
	email: string = "user@email.com",
	password: string = "password",
) => {
	await page.goto(`/login`);
	await page.fill('form#login-form input[name="email"]', email);
	await page.fill('form#login-form input[name="password"]', password);
	await page.click("form#login-form #login-form-submit-button");
};

const logout = async (page: Page) => {
	await page.goto("/logout");
};

test.beforeEach(async () => {
	await createUser();
    await createPoem();
});

/**
 * Clean up the database after each test. This function deletes all the rows
 * from the todos and subtodos tables and resets the sequence for each table.
 * @see https://www.postgresql.org/docs/13/sql-altersequence.html
 */
test.afterEach(async ({ page }) => {
	const tables = ["poems", "comments", "users"];

	try {
		for (const table of tables) {
			await sql.unsafe(`DELETE FROM ${table}`);
			await sql.unsafe(`ALTER SEQUENCE ${table}_id_seq RESTART WITH 1;`);
		}
	} catch (error) {
		console.error(error);
	}

	await logout(page);
});


test("All Comments were retrieved.", async ({ page }) => {
	await login(page);
	const comments = [await createComment(), await createComment(), await createComment()];

	await page.goto("poems/1");

	const h1 = await page.$("h1");
	const commentElements = await page.$$("[comment-id]");

	expect(await h1?.innerText()).toMatch("Comments");
	expect(commentElements.length).toBe(comments.length);

	for (let i = 0; i < commentElements.length; i++) {
		expect(await commentElements[i].innerText()).toMatch(comments[i].props.title);
	}
});

test("Comment created successfully.", async ({ page }) => {
	await login(page);
	const comment = {
		title: "Test Comment",
		description: "This is a test comment",
	};

	await page.goto("/poems/1");

	const h1 = await page.$("h1");

	expect(await h1?.innerText()).toMatch("Comments");

	await page.fill('form#new-comment-form textarea[name="title"]', comment.title);
	await page.fill(
		'form#new-comment-form textarea[name="description"]',
		comment.description,
	);
	await page.click("form#new-comment-form #new-poem-form-submit-button");

	expect(await page?.url()).toBe(getPath(`poems/1`));

	const titleElement = await page.$("#title-1");
	const descriptionElement = await page.$("#description-1");

	expect(await titleElement?.innerText()).toBe(comment.title);
	expect(await descriptionElement?.innerText()).toBe(comment.description);
});


test("Comment updated successfully.", async ({ page }) => {
	await login(page);
	const comment = await createComment();

	await page.goto(`poems/1/comments/${comment.props.id}/edit`);

	const h1 = await page.$("h1");

	expect(await h1?.innerText()).toMatch("Edit Comment");

	const newTitle = "Updated Test Comment";
	const newDescription = "This is an updated test comment";

	await page.fill('form#edit-comment-form input[name="title"]', newTitle);
	await page.fill(
		'form#edit-comment-form textarea[name="description"]',
		newDescription,
	);
	await page.click("form#edit-comment-form #edit-comment-form-submit-button");

	expect(await page?.url()).toBe(getPath(`poems/1`));

	const titleElement = await page.$("#title-1");
	const descriptionElement = await page.$("#description-1");

	expect(await titleElement?.innerText()).toBe(newTitle);
	expect(await descriptionElement?.innerText()).toBe(newDescription);
});

test("Comment deleted successfully.", async ({ page }) => {
	await login(page);
	const comment = await createComment();

	await page.goto(`poems/1`);

	await page.click("form#delete-comments-form-1 button");

	expect(await page?.url()).toBe(getPath(`poems/1`));

	const body = await page.$("body");

	expect(await body?.innerText()).toMatch("No comments posted");
});
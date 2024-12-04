import postgres from "postgres";
import { test, expect, Page } from "@playwright/test";
import { getPath } from "../src/url";
import User, { UserProps } from "../src/models/User";
import { createUTCDate } from "../src/utils"
import Poem, { PoemProps} from "../src/models/Poem";;

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

test("Homepage was retrieved successfully", async ({ page }) => {
	await page.goto("/");

	expect(await page?.title()).toBe("The poet guys");
});

test("Poem retrieved successfully.", async ({ page }) => {
	await login(page);
	const poem = await createPoem();

	await page.goto(`poems/${poem.props.id}`);

	const titleElement = await page.$("#title");
	const descriptionElement = await page.$("#description");

	expect(await titleElement?.innerText()).toBe(poem.props.title);
	expect(await descriptionElement?.innerText()).toBe(poem.props.description);
});


test("All Poems were retrieved.", async ({ page }) => {
	await login(page);
	const poems = [await createPoem(), await createPoem(), await createPoem()];

	await page.goto("/poems");

	const h1 = await page.$("h1");
	const poemElements = await page.$$("[poem-id]");

	expect(await h1?.innerText()).toMatch("Poems");
	expect(poemElements.length).toBe(poems.length);

	for (let i = 0; i < poemElements.length; i++) {
		expect(await poemElements[i].innerText()).toMatch(poems[i].props.title);
	}
});


test("Poem created successfully.", async ({ page }) => {
	await login(page);
	const poem = {
		title: "Test Poem",
		description: "This is a test poem",
	};

	await page.goto("/poems/new");

	const h1 = await page.$("h1");

	expect(await h1?.innerText()).toMatch("Create Poem");

	await page.fill('form#new-poem-form input[name="title"]', poem.title);
	await page.fill(
		'form#new-poem-form textarea[name="description"]',
		poem.description,
	);
	await page.click("form#new-poem-form #new-poem-form-submit-button");

	expect(await page?.url()).toBe(getPath(`poems/1`));

	const titleElement = await page.$("#title");
	const descriptionElement = await page.$("#description");

	expect(await titleElement?.innerText()).toBe(poem.title);
	expect(await descriptionElement?.innerText()).toBe(poem.description);
});

test("Poem not created while logged out.", async ({ page }) => {
	await page.goto(`/poems/new`);

	expect(await page?.url()).toBe(getPath("login"));
});

test("Poem updated successfully.", async ({ page }) => {
	await login(page);
	const poem = await createPoem();

	await page.goto(`poems/${poem.props.id}/edit`);

	const h1 = await page.$("h1");

	expect(await h1?.innerText()).toMatch("Edit Poem");

	const newTitle = "Updated Test Poem";
	const newDescription = "This is an updated test poem";

	await page.fill('form#edit-poem-form input[name="title"]', newTitle);
	await page.fill(
		'form#edit-poem-form textarea[name="description"]',
		newDescription,
	);
	await page.click("form#edit-poem-form #edit-poem-form-submit-button");

	expect(await page?.url()).toBe(getPath(`poems/${poem.props.id}`));

	const titleElement = await page.$("#title");
	const descriptionElement = await page.$("#description");

	expect(await titleElement?.innerText()).toBe(newTitle);
	expect(await descriptionElement?.innerText()).toBe(newDescription);
});

test("Poem not updated while logged out.", async ({ page }) => {
	const poem = await createPoem();

	await page.goto(`poems/${poem.props.id}/edit`);

	expect(await page?.url()).toBe(getPath("login"));
});

test("Poem deleted successfully.", async ({ page }) => {
	await login(page);
	const poem = await createPoem();

	await page.goto(`poems/${poem.props.id}`);

	await page.click("form#delete-poem-form button");

	expect(await page?.url()).toBe(getPath(`poems`));

	const body = await page.$("body");

	expect(await body?.innerText()).toMatch("No poems found");
});
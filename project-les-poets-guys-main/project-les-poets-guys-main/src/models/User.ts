import postgres from "postgres";
import { camelToSnake, convertToCase, createUTCDate, snakeToCamel } from "../utils";
import { isBuffer } from "util";

export interface UserProps {
	id?: number;
	email: string;
	password: string;
	createdAt: Date;
	editedAt?: Date;
	isAdmin: Boolean;
}

export class DuplicateEmailError extends Error {
	constructor() {
		super("User with this email already exists.");
	}
}

export class InvalidCredentialsError extends Error {
	constructor() {
		super("Invalid credentials.");
	}
}

export default class User {
	constructor(
		private sql: postgres.Sql<any>,
		public props: UserProps,
	) {}


	static async create(
		sql: postgres.Sql<any>,
		props: UserProps,
	): Promise<User> {
		let existUser = await sql`SELECT * FROM users WHERE email = ${props.email};`;
		if (existUser.length > 0){
			throw new DuplicateEmailError();
		}
		props.createdAt = props.createdAt ?? createUTCDate();
		let newUser = await sql`INSERT INTO users ${sql(convertToCase(camelToSnake, props))} RETURNING *;`;
		return new User(sql, convertToCase(snakeToCamel, newUser[0]) as UserProps);
	}
	static async read(
		sql: postgres.Sql<any>,
		id: number,
	){
		let user = await sql`SELECT * FROM users WHERE id = ${id};`
		if(user.length === 0){
			return null;
		}
		return new User(sql, convertToCase(snakeToCamel, user[0]) as UserProps)
	}
	async delete(): Promise<boolean> {
        await this.sql`DELETE FROM users WHERE id = ${this.props.id};`;
		return true
    }
	async toggleAdmin(): Promise<void> {
		let result;
		if(this.props.isAdmin){
			result = await this.sql`UPDATE users SET is_admin = FALSE, edited_at = ${createUTCDate()} WHERE id = ${this.props.id} RETURNING *;`;
		}
		else{
			result = await this.sql`UPDATE users SET is_admin = TRUE, edited_at = ${createUTCDate()} WHERE id = ${this.props.id} RETURNING *;`;
		}
		this.props = { ...this.props, ...convertToCase(snakeToCamel, result[0]) };
    }
	static async readAll(
		sql: postgres.Sql<any>
	): Promise<User[]> {


		const rows = await sql`
			SELECT *
			FROM users
		`;

		return rows.map(
			(row) =>
				new User(sql, convertToCase(snakeToCamel, row) as UserProps),
		);
	}

	static async login(
		sql: postgres.Sql<any>,
		email: string,
		password: string,
	): Promise<User> {
		let user = await sql`SELECT * FROM users WHERE email = ${email} and password = ${password};`;

		if (user.length === 0) {
			throw new InvalidCredentialsError();
		}
		return new User(sql, convertToCase(snakeToCamel, user[0]) as UserProps);
	}
}

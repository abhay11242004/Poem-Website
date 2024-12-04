import postgres from "postgres";
import {
	camelToSnake,
	convertToCase,
	createUTCDate,
	snakeToCamel,
} from "../utils";

export interface PoemProps {
	id?: number;
	title: string;
	description: string;
	createdAt: Date;
	editedAt?: Date;
    categoryId?: number
	userId: number;
}

export default class Poem {
	constructor(
		private sql: postgres.Sql<any>,
		public props: PoemProps,
	) {}

	static async create(sql: postgres.Sql<any>, props: PoemProps) {
		const connection = await sql.reserve();

		props.createdAt = props.createdAt ?? createUTCDate();

		const [row] = await connection<PoemProps[]>`
			INSERT INTO poems
				${sql(convertToCase(camelToSnake, props))}
			RETURNING *
		`;

		await connection.release();

		return new Poem(sql, convertToCase(snakeToCamel, row) as PoemProps);
	}

	static async read(sql: postgres.Sql<any>, id: number) {
		const connection = await sql.reserve();

		const [row] = await connection<PoemProps[]>`
			SELECT * FROM
			poems WHERE id = ${id}
		`;

		await connection.release();

		if (!row) {
			return null;
		}

		return new Poem(sql, convertToCase(snakeToCamel, row) as PoemProps);
	}

	static async readAll(
		sql: postgres.Sql<any>,
		categoryId?: number,
	): Promise<Poem[]> {
		const connection = await sql.reserve();
		let rows;
		if(categoryId){
			rows = await connection<PoemProps[]>`
			SELECT *
			FROM poems
			WHERE category_id = ${categoryId}
		`;
		}
		else{
		    rows = await connection<PoemProps[]>`
				SELECT *
				FROM poems
			`;
		}
		
		await connection.release();

		return rows.map(
			(row) =>
				new Poem(sql, convertToCase(snakeToCamel, row) as PoemProps),
		);
	}
	static async readAllFromUserId(
		sql: postgres.Sql<any>,
		userId?: number,
		filters?: Partial<PoemProps>,
		sortBy?: string,
		orderBy?: string,
	): Promise<Poem[]> {
		const connection = await sql.reserve();

	
		const rows = await connection<PoemProps[]>`
			SELECT *
			FROM poems
			WHERE user_id = ${userId}
		`;
		
		await connection.release();

		return rows.map(
			(row) =>
				new Poem(sql, convertToCase(snakeToCamel, row) as PoemProps),
		);
	}
	async update(updateProps: Partial<PoemProps>) {
		const connection = await this.sql.reserve();

		const [row] = await connection`
			UPDATE poems
			SET
				${this.sql(convertToCase(camelToSnake, updateProps))}, edited_at = ${createUTCDate()}
			WHERE
				id = ${this.props.id}
			RETURNING *
		`;

		await connection.release();

		this.props = { ...this.props, ...convertToCase(snakeToCamel, row) };
	}

	async delete() {
		const connection = await this.sql.reserve();

		const result = await connection`
			DELETE FROM poems
			WHERE id = ${this.props.id}
		`;

		await connection.release();

		return result.count === 1;
	}
}

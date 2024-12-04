import postgres from "postgres";
import {
	camelToSnake,
	convertToCase,
	createUTCDate,
	snakeToCamel,
} from "../utils";

export interface CategoryProps {
	id?: number;
    name: string;
}

export default class Category {
	constructor(
		private sql: postgres.Sql<any>,
		public props: CategoryProps,
	) {}


	static async getCategory(sql: postgres.Sql<any>, category: string) {
		const connection = await sql.reserve();

		const [row] = await connection<CategoryProps[]>`
			SELECT * FROM
			categories WHERE name = ${category}
		`;

		await connection.release();

		if (!row) {
			return null;
		}

		return new Category(sql, convertToCase(snakeToCamel, row) as CategoryProps);
	}
    static async read(sql: postgres.Sql<any>, id: number) {
		const connection = await sql.reserve();

		const [row] = await connection<CategoryProps[]>`
			SELECT * FROM
			categories WHERE id = ${id}
		`;

		await connection.release();

		if (!row) {
			return null;
		}

		return new Category(sql, convertToCase(snakeToCamel, row) as CategoryProps);
	}
}

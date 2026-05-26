import { StakingSchema, json, readJson, serverError } from "../_lib";

export async function GET() {
  try {
    const staking = await readJson("staking.json", StakingSchema);
    return json(staking);
  } catch (err) {
    return serverError(err);
  }
}

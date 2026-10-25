import {NextResponse} from "next/server";
export const dynamic="force-dynamic";
// Intentionally disabled: existing player records and links are frozen.
export async function GET(){return NextResponse.json({error:"Player synchronization is disabled to protect the existing roster."},{status:410});}

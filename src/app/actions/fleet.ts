"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { aircraft, squawk, user } from "@/lib/db/schema";
import { requireUser } from "@/lib/server/session";
import { aircraftSchema, profileSchema, signatureSchema, squawkSchema } from "@/lib/validation";
import { fail, UserError, type ActionResult } from "./result";

function toAircraftRow(input: unknown) {
  const { initialHours, ...rest } = aircraftSchema.parse(input);
  return { ...rest, initialSeconds: Math.round(initialHours * 3600) };
}

export async function createAircraft(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const me = await requireUser();
    if (me.role !== "admin") throw new UserError("Only an admin can add aircraft");
    const [row] = await db.insert(aircraft).values(toAircraftRow(input)).returning({ id: aircraft.id });
    revalidatePath("/", "layout");
    return { success: true, data: { id: row.id } };
  } catch (error) {
    return fail(error);
  }
}

export async function updateAircraft(id: string, input: unknown): Promise<ActionResult> {
  try {
    const me = await requireUser();
    if (me.role !== "admin") throw new UserError("Only an admin can edit aircraft");
    await db.update(aircraft).set(toAircraftRow(input)).where(eq(aircraft.id, id));
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    return fail(error);
  }
}

export async function setAircraftArchived(id: string, archived: boolean): Promise<ActionResult> {
  try {
    const me = await requireUser();
    if (me.role !== "admin") throw new UserError("Only an admin can archive aircraft");
    await db.update(aircraft).set({ archived }).where(eq(aircraft.id, id));
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    return fail(error);
  }
}

export async function saveSquawk(id: string | null, input: unknown): Promise<ActionResult> {
  try {
    const me = await requireUser();
    const data = squawkSchema.parse(input);
    const values = {
      ...data,
      actionOn: data.actionOn || null,
      action: data.action || null,
      confirmer: data.confirmer || null,
    };
    if (id) {
      const row = await db.query.squawk.findFirst({ where: eq(squawk.id, id) });
      if (!row) throw new UserError("Not found");
      if (row.reportedBy !== me.id && me.role !== "admin") throw new UserError("Only the reporter or an admin can edit");
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { aircraftId: _ignored, ...editable } = values;
      await db.update(squawk).set(editable).where(eq(squawk.id, id));
    } else {
      await db.insert(squawk).values({ ...values, reportedBy: me.id });
    }
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteSquawk(id: string): Promise<ActionResult> {
  try {
    const me = await requireUser();
    const row = await db.query.squawk.findFirst({ where: eq(squawk.id, id) });
    if (!row) throw new UserError("Not found");
    if (row.reportedBy !== me.id && me.role !== "admin") throw new UserError("Only the reporter or an admin can delete");
    await db.delete(squawk).where(eq(squawk.id, id));
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    return fail(error);
  }
}

export async function updateProfile(input: unknown): Promise<ActionResult> {
  try {
    const me = await requireUser();
    const data = profileSchema.parse(input);
    await db
      .update(user)
      .set({ name: data.name, licenseNumber: data.licenseNumber || null })
      .where(eq(user.id, me.id));
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    return fail(error);
  }
}

export async function saveSignature(dataUrl: string | null): Promise<ActionResult> {
  try {
    const me = await requireUser();
    const signature = dataUrl === null ? null : signatureSchema.parse(dataUrl);
    await db.update(user).set({ signature }).where(eq(user.id, me.id));
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    return fail(error);
  }
}

"use server";

import { refresh } from "next/cache";
import type { Role } from "@/db/schema";
import { addPerson, changeOwnPassword, resetPassword, setRole } from "@/domain/people";
import { authorize, currentSessionId } from "./dal";
import { type FormState, field, formError } from "./form-state";
import { ACTION_COPY } from "./action-copy";

/** A temporary password to hand over, shown once. `at` changes every time. */
export type Handover = { name: string; password: string; at: number };

export type AddPersonState = FormState & { added?: Handover };

/** Adds a person with a temporary password for the admin to hand over. Admin-only. */
export async function addPersonAction(_previous: AddPersonState, formData: FormData): Promise<AddPersonState> {
  const { db, user, language } = await authorize();
  const values = { name: field(formData, "name"), email: field(formData, "email"), role: field(formData, "role") };
  try {
    const { person, password } = await addPerson(db, user, {
      name: values.name,
      email: values.email,
      role: values.role as Role,
    });
    refresh();
    return { added: { name: person.name, password, at: Date.now() } };
  } catch (error) {
    return formError(error, language, values);
  }
}

export type PersonState = FormState & { done?: { message: string; at: number }; reset?: Handover };

/** Makes someone an admin or staff (`intent=role`, `role`), or resets their password (`intent=reset`). Admin-only. */
export async function changePerson(_previous: PersonState, formData: FormData): Promise<PersonState> {
  const { db, user, language } = await authorize();
  const t = ACTION_COPY[language];
  const id = Number(field(formData, "personId"));
  try {
    if (field(formData, "intent") === "reset") {
      const { name, password } = await resetPassword(db, user, id);
      refresh();
      return { reset: { name, password, at: Date.now() } };
    }
    const { name, role } = await setRole(db, user, id, field(formData, "role") as Role);
    refresh();
    return { done: { message: t.roleChanged(name, role), at: Date.now() } };
  } catch (error) {
    return formError(error, language);
  }
}

export type PasswordState = FormState & { done?: { message: string; at: number } };

/** Changes the signed-in person's own password, ending their other sessions. */
export async function changeMyPassword(_previous: PasswordState, formData: FormData): Promise<PasswordState> {
  const { db, user, language } = await authorize();
  try {
    await changeOwnPassword(
      db,
      user,
      { current: field(formData, "current"), next: field(formData, "next") },
      await currentSessionId(),
    );
    return { done: { message: ACTION_COPY[language].passwordChanged, at: Date.now() } };
  } catch (error) {
    return formError(error, language);
  }
}

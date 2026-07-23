"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  addBuildItem,
  createBuildProject,
  importMaterials,
  updateBuildItem,
  updateBuildProject,
} from "@/actions/builds";
import type { ActionState } from "@/lib/forms";
import { ErrorBanner, inputClass, labelClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

/** Found a new build project. */
export function CreateBuildProjectForm() {
  const [state, action] = useActionState<ActionState, FormData>(createBuildProject, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state === null) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="space-y-4">
      {state?.error && <ErrorBanner message={state.error} />}
      <div>
        <label htmlFor="project-name" className={labelClass}>
          Project name
        </label>
        <input
          id="project-name"
          name="name"
          required
          maxLength={120}
          placeholder="The Grand Cathedral"
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="project-description" className={labelClass}>
          Description <span className="normal-case text-slate-600">(optional)</span>
        </label>
        <textarea
          id="project-description"
          name="description"
          rows={2}
          maxLength={2000}
          placeholder="What it is, where it stands, who's building it…"
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="project-priority" className={labelClass}>
          Priority <span className="normal-case text-slate-600">(lower claims stock first)</span>
        </label>
        <input
          id="project-priority"
          name="priority"
          type="number"
          min={0}
          defaultValue={0}
          className={inputClass}
        />
      </div>
      <SubmitButton>Found the project</SubmitButton>
    </form>
  );
}

/** Edit an existing project's name, description and priority. */
export function EditBuildProjectForm({
  projectId,
  name,
  description,
  priority,
}: {
  projectId: string;
  name: string;
  description: string | null;
  priority: number;
}) {
  const [state, action] = useActionState<ActionState, FormData>(updateBuildProject, null);

  return (
    <form action={action} className="space-y-4">
      {state?.error && <ErrorBanner message={state.error} />}
      <input type="hidden" name="project_id" value={projectId} />
      <div>
        <label htmlFor="edit-name" className={labelClass}>
          Project name
        </label>
        <input
          id="edit-name"
          name="name"
          required
          maxLength={120}
          defaultValue={name}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="edit-description" className={labelClass}>
          Description
        </label>
        <textarea
          id="edit-description"
          name="description"
          rows={2}
          maxLength={2000}
          defaultValue={description ?? ""}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="edit-priority" className={labelClass}>
          Priority
        </label>
        <input
          id="edit-priority"
          name="priority"
          type="number"
          min={0}
          defaultValue={priority}
          className={inputClass}
        />
      </div>
      <SubmitButton>Save changes</SubmitButton>
    </form>
  );
}

/** Add one requirement line to a project. */
export function AddBuildItemForm({ projectId }: { projectId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(addBuildItem, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state === null) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="space-y-4">
      {state?.error && <ErrorBanner message={state.error} />}
      <input type="hidden" name="project_id" value={projectId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="item-name" className={labelClass}>
            Item
          </label>
          <input
            id="item-name"
            name="display_name"
            required
            maxLength={120}
            placeholder="Oak Planks"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="item-qty" className={labelClass}>
            How many
          </label>
          <input
            id="item-qty"
            name="required_quantity"
            type="number"
            min={1}
            required
            placeholder="1728"
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label htmlFor="item-id" className={labelClass}>
          Minecraft ID{" "}
          <span className="normal-case text-slate-600">(optional — guessed from the name)</span>
        </label>
        <input
          id="item-id"
          name="item_id"
          maxLength={160}
          placeholder="minecraft:oak_planks"
          className={`${inputClass} font-mono text-sm`}
        />
      </div>
      <SubmitButton>Add the requirement</SubmitButton>
    </form>
  );
}

/** Import a pasted Litematica / free-form material list. */
export function ImportMaterialsForm({ projectId }: { projectId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(importMaterials, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state === null) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="space-y-4">
      {state?.error && <ErrorBanner message={state.error} />}
      <input type="hidden" name="project_id" value={projectId} />
      <div>
        <label htmlFor="materials" className={labelClass}>
          Paste a material list
        </label>
        <textarea
          id="materials"
          name="materials"
          rows={8}
          required
          placeholder={"Oak Planks x1728\nStone, 4096\nminecraft:glass 512"}
          className={`${inputClass} font-mono text-sm`}
        />
        <p className="mt-1.5 text-xs text-slate-500">
          Litematica material lists, <code className="text-gold-400">Name x123</code>,{" "}
          <code className="text-gold-400">123 x Name</code>, or{" "}
          <code className="text-gold-400">name,count</code>. Re-importing updates existing
          amounts.
        </p>
      </div>
      <SubmitButton>Import the list</SubmitButton>
    </form>
  );
}

/** Inline editor for one requirement line's target and reservation override. */
export function EditBuildItemForm({
  itemRowId,
  projectId,
  required,
  override,
}: {
  itemRowId: string;
  projectId: string;
  required: number;
  override: number | null;
}) {
  const [state, action] = useActionState<ActionState, FormData>(updateBuildItem, null);

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      {state?.error && (
        <div className="w-full">
          <ErrorBanner message={state.error} />
        </div>
      )}
      <input type="hidden" name="item_row_id" value={itemRowId} />
      <input type="hidden" name="project_id" value={projectId} />
      <div>
        <label className={labelClass}>Required</label>
        <input
          name="required_quantity"
          type="number"
          min={1}
          defaultValue={required}
          className={`${inputClass} w-28`}
        />
      </div>
      <div>
        <label className={labelClass}>
          Override <span className="normal-case text-slate-600">(blank = auto)</span>
        </label>
        <input
          name="manual_override"
          type="number"
          min={0}
          defaultValue={override ?? ""}
          placeholder="auto"
          className={`${inputClass} w-28`}
        />
      </div>
      <button
        type="submit"
        className="pressable inline-flex items-center gap-1.5 rounded-lg border border-gold-500/40 px-3 py-2.5 font-display text-xs font-bold tracking-wider text-gold-300 hover:border-gold-400 hover:bg-gold-400/10"
      >
        Save
      </button>
    </form>
  );
}

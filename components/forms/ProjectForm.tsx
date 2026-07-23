"use client";

import { useActionState } from "react";
import { createProject, updateProject } from "@/actions/projects";
import type { Project } from "@/lib/supabase";
import type { ActionState } from "@/lib/forms";
import { ErrorBanner, inputClass, labelClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

/** Add form when `project` is omitted; edit form when it's supplied. */
export function ProjectForm({ project }: { project?: Project }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    project ? updateProject : createProject,
    null
  );
  // Several of these forms render on one page - keep input ids unique.
  const uid = project?.id ?? "new";

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <ErrorBanner message={state.error} />}
      {project && <input type="hidden" name="id" value={project.id} />}

      <div>
        <label htmlFor={`title-${uid}`} className={labelClass}>
          Title
        </label>
        <input
          id={`title-${uid}`}
          name="title"
          required
          maxLength={120}
          defaultValue={project?.title ?? ""}
          placeholder="The Grand Cathedral"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor={`description-${uid}`} className={labelClass}>
          Description
        </label>
        <textarea
          id={`description-${uid}`}
          name="description"
          required
          rows={3}
          defaultValue={project?.description ?? ""}
          placeholder="What is it, and why is it worth seeing?"
          className={`${inputClass} resize-y`}
        />
      </div>

      <div>
        <label htmlFor={`image_url-${uid}`} className={labelClass}>
          Image link
        </label>
        <input
          id={`image_url-${uid}`}
          name="image_url"
          type="url"
          defaultValue={project?.image_url ?? ""}
          placeholder="https://cdn.discordapp.com/..."
          className={inputClass}
        />
        <p className="mt-1.5 text-xs text-slate-500">
          Drop a screenshot in any Discord channel → right-click → Copy Link →
          paste here. Leave empty to show a placeholder tile.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor={`builder-${uid}`} className={labelClass}>
            Built by
          </label>
          <input
            id={`builder-${uid}`}
            name="builder"
            maxLength={120}
            defaultValue={project?.builder ?? ""}
            placeholder="House Meridian"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`tag-${uid}`} className={labelClass}>
            Tag
          </label>
          <input
            id={`tag-${uid}`}
            name="tag"
            maxLength={60}
            defaultValue={project?.tag ?? ""}
            placeholder="Landmark"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`sort_order-${uid}`} className={labelClass}>
            Order
          </label>
          <input
            id={`sort_order-${uid}`}
            name="sort_order"
            type="number"
            defaultValue={project?.sort_order ?? 0}
            className={inputClass}
          />
        </div>
      </div>

      <SubmitButton>{project ? "Save Changes" : "Add to the Great Works"}</SubmitButton>
    </form>
  );
}

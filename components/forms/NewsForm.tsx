"use client";

import { useActionState } from "react";
import { createNews, updateNews } from "@/actions/news";
import type { NewsPost } from "@/lib/supabase";
import type { ActionState } from "@/lib/forms";
import { ErrorBanner, inputClass, labelClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

/** Add form when `post` is omitted; edit form when it's supplied. */
export function NewsForm({ post }: { post?: NewsPost }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    post ? updateNews : createNews,
    null
  );
  // Several of these render on one page — keep input ids unique.
  const uid = post?.id ?? "new";

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <ErrorBanner message={state.error} />}
      {post && <input type="hidden" name="id" value={post.id} />}

      <div>
        <label htmlFor={`title-${uid}`} className={labelClass}>
          Headline
        </label>
        <input
          id={`title-${uid}`}
          name="title"
          required
          maxLength={160}
          defaultValue={post?.title ?? ""}
          placeholder="The Harbor District Opens"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor={`summary-${uid}`} className={labelClass}>
          Blurb
        </label>
        <input
          id={`summary-${uid}`}
          name="summary"
          defaultValue={post?.summary ?? ""}
          placeholder="One line shown in the feed and on the dashboard."
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor={`body-${uid}`} className={labelClass}>
          Dispatch
        </label>
        <textarea
          id={`body-${uid}`}
          name="body"
          required
          rows={8}
          defaultValue={post?.body ?? ""}
          placeholder="Tell the nation what happened…"
          className={`${inputClass} resize-y`}
        />
        <p className="mt-1.5 text-xs text-slate-500">
          Plain text — line breaks and paragraphs are preserved.
        </p>
      </div>

      <div>
        <label htmlFor={`image_url-${uid}`} className={labelClass}>
          Image link
        </label>
        <input
          id={`image_url-${uid}`}
          name="image_url"
          type="url"
          defaultValue={post?.image_url ?? ""}
          placeholder="https://cdn.discordapp.com/..."
          className={inputClass}
        />
        <p className="mt-1.5 text-xs text-slate-500">
          Drop a screenshot in any Discord channel → right-click → Copy Link →
          paste here.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`author-${uid}`} className={labelClass}>
            Signed by
          </label>
          <input
            id={`author-${uid}`}
            name="author"
            maxLength={120}
            defaultValue={post?.author ?? ""}
            placeholder="The Council"
            className={inputClass}
          />
        </div>
        <label
          htmlFor={`pinned-${uid}`}
          className="flex cursor-pointer items-center gap-3 self-end rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-2.5"
        >
          <input
            id={`pinned-${uid}`}
            name="pinned"
            type="checkbox"
            defaultChecked={post?.pinned ?? false}
            className="h-4 w-4 accent-gold-400"
          />
          <span className="text-sm font-semibold text-slate-300">
            Important — pin to the top
          </span>
        </label>
      </div>

      <SubmitButton>{post ? "Save Changes" : "Post the Dispatch"}</SubmitButton>
    </form>
  );
}

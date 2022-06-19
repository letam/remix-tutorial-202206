import type { ActionFunction, LoaderFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  Form,
  useActionData,
  useFormAction,
  useLoaderData,
  useTransition,
} from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import invariant from "tiny-invariant";

import type { Post } from "~/models/post.server";

import { getPost, updatePost, deletePost } from "~/models/post.server";
import { requireUserId } from "~/session.server"

import DangerModal from "~/components/modals/DangerModal";

type ActionData =
  | {
      title: null | string;
      slug: null | string;
      markdown: null | string;
    }
  | undefined;
export const action: ActionFunction = async ({ request }) => {
  const userId = await requireUserId(request);

  const formData = await request.formData();
  const { _action, ...values } = Object.fromEntries(formData);

  if (_action === "delete") {
    const slug = formData.get("slug");
    await deletePost(slug as string);

    return redirect("/posts/admin");
  }

  const initialSlug = formData.get("initialSlug");
  const title = formData.get("title");
  const slug = formData.get("slug");
  const markdown = formData.get("markdown");

  const errors: ActionData = {
    title: title ? null : "Title is required",
    slug: slug ? null : "Slug is required",
    markdown: markdown ? null : "Markdown is required",
  };
  const hasErrors = Object.values(errors).some((errorMessage) => errorMessage);
  if (hasErrors) {
    return json<ActionData>(errors);
  }

  invariant(typeof initialSlug === "string", "initial slug must be a string");
  invariant(typeof title === "string", "title must be a string");
  invariant(typeof slug === "string", "slug must be a string");
  invariant(typeof markdown === "string", "markdown must be a string");

  await updatePost(initialSlug, { title, slug, markdown });

  return redirect("/posts/admin");
};

const inputClassName = `w-full rounded border border-gray-500 px-2 py-1 text-lg`;

type LoaderData = { post: Post };

export const loader: LoaderFunction = async ({ params }) => {
  invariant(params.slug, `params.slug is required`);

  const post = await getPost(params.slug);
  invariant(post, `Post not found: ${params.slug}`);

  return json<LoaderData>({ post });
};

export default function EditPostSlug() {
  const errors = useActionData();
  const { post } = useLoaderData<LoaderData>();

  const [activeButton, setActiveButton] = useState<string>();

  const transition = useTransition();
  const isSubmitting = Boolean(transition.submission);
  const isUpdating = isSubmitting && activeButton === "update";
  const isDeleting = isSubmitting && activeButton === "delete";

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (!transition.submission) {
      setActiveButton("");
    }
  }, [transition]);

  const titleRef = useRef() as React.MutableRefObject<HTMLInputElement>;
  const slugRef = useRef() as React.MutableRefObject<HTMLInputElement>;
  const markdownRef = useRef() as React.MutableRefObject<HTMLTextAreaElement>;

  useEffect(() => {
    titleRef.current.value = post.title;
    slugRef.current.value = post.slug;
    markdownRef.current.value = post.markdown;
  }, [post.slug]);

  return (
    <Form method="post">
      <input type="hidden" name="initialSlug" value={post.slug} />
      <p>
        <label>
          Post Title:{" "}
          {errors?.title ? (
            <em className="text-red-600">{errors.title}</em>
          ) : null}
          <input
            type="text"
            name="title"
            className={inputClassName}
            ref={titleRef}
            defaultValue={post.title}
          />
        </label>
      </p>
      <p>
        <label>
          Post Slug:{" "}
          {errors?.slug ? (
            <em className="text-red-600">{errors.slug}</em>
          ) : null}
          <input
            type="text"
            name="slug"
            className={inputClassName}
            ref={slugRef}
            defaultValue={post.slug}
          />
        </label>
      </p>
      <p>
        <label htmlFor="markdown">
          Markdown:{" "}
          {errors?.markdown ? (
            <em className="text-red-600">{errors.markdown}</em>
          ) : null}
        </label>
        <br />
        <textarea
          id="markdown"
          rows={20}
          name="markdown"
          className={`${inputClassName} font-mono`}
          ref={markdownRef}
          defaultValue={post.markdown}
        />
      </p>
      <p className="flex flex-row-reverse text-right">
        <button
          type="submit"
          className="rounded bg-blue-500 py-2 px-4 text-white hover:bg-blue-600 focus:bg-blue-400 disabled:bg-blue-300"
          onClick={() => setActiveButton("update")}
          disabled={isSubmitting}
        >
          {isUpdating ? "Updating..." : "Update Post"}
        </button>
        <button
          type="submit"
          aria-label="delete"
          id="delete-post"
          name="_action"
          value="delete"
          className="mx-4 rounded bg-red-500 py-2 px-4 text-white hover:bg-red-600 focus:bg-red-400 disabled:bg-red-300"
          onClick={(event) => {
            if (showDeleteModal) {
              setActiveButton("delete");
              return;
            }
            event.preventDefault();
            setShowDeleteModal(true);
          }}
          disabled={isSubmitting}
        >
          {isDeleting ? "Deleting..." : "Delete Post"}
        </button>
      </p>
      {showDeleteModal && (
        <DeleteModal
          confirmButtonLabel={isDeleting ? "Deleting..." : "Delete Post"}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={() => {
            const deletePostButton = document.querySelector(
              "#delete-post"
            )! as HTMLElement;
            deletePostButton.click();
          }}
          title={"Delete Post"}
        >
          Are you sure you want to delete this post?
        </DeleteModal>
      )}
    </Form>
  );
}

function DeleteModal({
  children,
  confirmButtonLabel,
  onClose,
  onConfirm,
  title,
}: {
  children: string;
  confirmButtonLabel: string;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
}) {
  return (
    <DangerModal
      confirmButtonLabel={confirmButtonLabel}
      onClose={onClose}
      onConfirm={onConfirm}
      title={title}
    >
      {children}
    </DangerModal>
  );
}

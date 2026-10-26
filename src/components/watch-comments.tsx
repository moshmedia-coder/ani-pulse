import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  readAnimeComments,
  writeAnimeComments,
  type LocalAnimeComment,
} from "@/lib/watch-comments";

const MAX_COMMENT_LENGTH = 500;

function relativeTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(timestamp),
  );
}

export function WatchComments({ animeId }: { animeId: number }) {
  const [comments, setComments] = useState<LocalAnimeComment[]>([]);
  const [draft, setDraft] = useState("");
  const [validationMessage, setValidationMessage] = useState("");
  const [storageMessage, setStorageMessage] = useState("");

  useEffect(() => {
    const result = readAnimeComments(animeId);
    setComments(result.comments);
    setStorageMessage(
      result.ok ? "" : "Saved comments could not be read. Browser storage may be unavailable or damaged.",
    );
  }, [animeId]);

  function submitComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) {
      setValidationMessage("Write a comment before posting.");
      return;
    }
    if (text.length > MAX_COMMENT_LENGTH) {
      setValidationMessage(`Comments must be ${MAX_COMMENT_LENGTH} characters or fewer.`);
      return;
    }
    setValidationMessage("");

    const comment: LocalAnimeComment = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      author: "You",
      text,
      createdAt: new Date().toISOString(),
    };
    const nextComments = [comment, ...comments];
    const result = writeAnimeComments(animeId, nextComments);
    if (!result.ok) {
      setStorageMessage("Your comment could not be saved. Check this browser's storage settings.");
      return;
    }
    setComments(nextComments);
    setDraft("");
    setStorageMessage("");
  }

  function deleteComment(commentId: string) {
    const nextComments = comments.filter((comment) => comment.id !== commentId);
    const result = writeAnimeComments(animeId, nextComments);
    if (!result.ok) {
      setStorageMessage("This comment could not be deleted from browser storage.");
      return;
    }
    setComments(nextComments);
    setStorageMessage("");
  }

  return (
    <section className="watch-comments" aria-labelledby="watch-comments-title">
      <div className="watch-section-heading">
        <div>
          <p className="watch-kicker">YOUR SPACE</p>
          <h2 id="watch-comments-title">Discussion</h2>
        </div>
        <span className="watch-local-badge">Local to this browser/device</span>
      </div>
      <p className="watch-comments-note">
        Your notes are saved only in this browser. They are not public or shared with other viewers.
      </p>
      <form onSubmit={submitComment} className="watch-comment-form">
        <label htmlFor="watch-comment-input">Add a comment</label>
        <textarea
          id="watch-comment-input"
          value={draft}
          maxLength={MAX_COMMENT_LENGTH}
          rows={3}
          placeholder="What did you think of this anime?"
          aria-describedby="watch-comment-help watch-comment-validation"
          aria-invalid={Boolean(validationMessage)}
          onChange={(event) => {
            setDraft(event.target.value);
            if (validationMessage) setValidationMessage("");
          }}
        />
        <div className="watch-comment-actions">
          <span id="watch-comment-help">{draft.length}/{MAX_COMMENT_LENGTH}</span>
          <Button type="submit" size="sm">Post comment</Button>
        </div>
        <p id="watch-comment-validation" className="watch-comment-validation" role="alert">
          {validationMessage}
        </p>
      </form>
      {storageMessage && (
        <p className="watch-comment-storage-error" role="status">
          {storageMessage}
        </p>
      )}
      {comments.length ? (
        <ol className="watch-comment-list" aria-label="Your comments, newest first">
          {comments.map((comment) => (
            <li key={comment.id}>
              <div className="watch-comment-heading">
                <strong>{comment.author}</strong>
                <time dateTime={comment.createdAt}>{relativeTimestamp(comment.createdAt)}</time>
              </div>
              <p>{comment.text}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Delete comment: ${comment.text.slice(0, 60)}`}
                onClick={() => deleteComment(comment.id)}
              >
                Delete
              </Button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="watch-empty-state">No comments yet. Leave the first note for yourself.</p>
      )}
    </section>
  );
}

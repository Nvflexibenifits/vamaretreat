"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";

export function CrmNoteModal() {
  const { modal, closeModal, guestNotes, setGuestNote, showNotif } = useApp();
  const [text, setText] = useState("");

  useEffect(() => {
    if (modal.kind === "crm-note" && modal.crmKey) {
      setText(guestNotes[modal.crmKey.mobile] || "");
    }
  }, [modal, guestNotes]);

  if (modal.kind !== "crm-note" || !modal.crmKey) return null;

  const onSave = () => {
    setGuestNote(modal.crmKey!.mobile, text.trim());
    closeModal();
    showNotif("Note saved", "success");
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div className="modal modal-sm">
        <h3>Edit Guest Note</h3>
        <p className="modal-desc">Note for {modal.crmKey.name}</p>
        <div className="field">
          <label>Note</label>
          <textarea
            rows={3}
            style={{ resize: "vertical" }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Meal preferences, special requirements, VIP status..."
          />
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={closeModal}>Cancel</button>
          <button className="btn btn-primary" onClick={onSave}>Save Note</button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { getAuthToken } from '@/api/auth';
import { fetchReservations, saveReservations, type ReservationSaveScope } from '@/api/reservations';
import { createId } from '@/lib/id';
import type { Reservation, ReservationDraft } from '@/types/reservation';

type ReservationStatus = 'loading' | 'ready' | 'error';

export function useReservations(canPersist = false) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [status, setStatus] = useState<ReservationStatus>('loading');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const saveSequenceRef = useRef(0);
  const saveScopeRef = useRef<ReservationSaveScope>({ knownReservationIds: [] });

  useEffect(() => {
    let cancelled = false;

    async function loadReservations() {
      setStatus('loading');
      setError('');

      try {
        const loadedReservations = normalizeReservations(await fetchReservations());
        if (cancelled) return;
        saveScopeRef.current = reservationSaveScope(loadedReservations);
        setReservations(loadedReservations);
        setStatus('ready');
      } catch (loadError) {
        if (cancelled) return;
        setStatus('error');
        setError(loadError instanceof Error ? loadError.message : '예약/티켓을 불러오지 못했습니다.');
      }
    }

    void loadReservations();
    return () => {
      cancelled = true;
    };
  }, []);

  function updateReservations(updater: (current: Reservation[]) => Reservation[]) {
    setReservations((current) => {
      const nextReservations = normalizeReservations(updater(current));
      if (canPersist && getAuthToken()) {
        saveScopeRef.current = mergeReservationSaveScopes(saveScopeRef.current, reservationSaveScope(nextReservations));
        void persistReservations(nextReservations);
      }
      return nextReservations;
    });
  }

  async function persistReservations(nextReservations: Reservation[]) {
    const sequence = ++saveSequenceRef.current;
    setIsSaving(true);
    setError('');

    try {
      const savedReservations = normalizeReservations(await saveReservations(nextReservations, saveScopeRef.current));
      if (sequence === saveSequenceRef.current) {
        saveScopeRef.current = reservationSaveScope(savedReservations);
        setReservations(savedReservations);
        setStatus('ready');
      }
    } catch (saveError) {
      if (sequence === saveSequenceRef.current) {
        setStatus('error');
        setError(saveError instanceof Error ? saveError.message : '예약/티켓을 저장하지 못했습니다.');
      }
    } finally {
      if (sequence === saveSequenceRef.current) {
        setIsSaving(false);
      }
    }
  }

  function addReservation(draft: ReservationDraft) {
    updateReservations((current) => [
      ...current,
      {
        id: createId('reservation'),
        ...normalizeDraft(draft)
      }
    ]);
  }

  function addReservations(drafts: ReservationDraft[]) {
    updateReservations((current) => [
      ...current,
      ...drafts.map((draft) => ({
        id: createId('reservation'),
        ...normalizeDraft(draft)
      }))
    ]);
  }

  function updateReservation(id: string, draft: ReservationDraft) {
    updateReservations((current) =>
      current.map((reservation) => (reservation.id === id ? { id, ...normalizeDraft(draft) } : reservation))
    );
  }

  function setReservationCompleted(id: string, completed: boolean) {
    updateReservations((current) =>
      current.map((reservation) => (reservation.id === id ? { ...reservation, completed } : reservation))
    );
  }

  function removeReservation(id: string) {
    updateReservations((current) => current.filter((reservation) => reservation.id !== id));
  }

  return {
    reservations,
    status,
    error,
    isSaving,
    addReservation,
    addReservations,
    updateReservation,
    setReservationCompleted,
    removeReservation
  };
}

function normalizeReservations(reservations: Reservation[]) {
  return reservations.map((reservation) => ({
    id: reservation.id,
    ...normalizeDraft(reservation)
  }));
}

function reservationSaveScope(reservations: Reservation[]): ReservationSaveScope {
  return {
    knownReservationIds: reservations.map((reservation) => reservation.id)
  };
}

function mergeReservationSaveScopes(current: ReservationSaveScope, next: ReservationSaveScope): ReservationSaveScope {
  return {
    knownReservationIds: Array.from(new Set([...current.knownReservationIds, ...next.knownReservationIds]))
  };
}

function normalizeDraft(draft: ReservationDraft): ReservationDraft {
  return {
    reservationType: draft.reservationType,
    title: draft.title.trim(),
    dayIndex: typeof draft.dayIndex === 'number' ? draft.dayIndex : null,
    placeId: draft.placeId?.trim() || null,
    timeLabel: draft.timeLabel.trim(),
    bookingPlatform: (draft.bookingPlatform ?? '').trim(),
    referenceNumber: draft.referenceNumber.trim(),
    linkUrl: draft.linkUrl.trim(),
    notes: draft.notes.trim(),
    attachments: normalizeAttachments(draft.attachments ?? []),
    completed: draft.completed === true
  };
}

function normalizeAttachments(attachments: ReservationDraft['attachments']) {
  return attachments
    .filter((attachment) => attachment.id && attachment.fileName && attachment.dataUrl)
    .map((attachment) => ({
      id: attachment.id,
      fileName: attachment.fileName.trim(),
      contentType: attachment.contentType.trim(),
      sizeBytes: attachment.sizeBytes,
      dataUrl: attachment.dataUrl
    }));
}

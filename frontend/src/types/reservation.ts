export type ReservationType = 'restaurant' | 'ticket' | 'transport' | 'hotel' | 'other';

export type Reservation = {
  id: string;
  reservationType: ReservationType;
  title: string;
  dayIndex: number | null;
  placeId: string | null;
  timeLabel: string;
  referenceNumber: string;
  linkUrl: string;
  notes: string;
  attachments: ReservationAttachment[];
  completed: boolean;
};

export type ReservationAttachment = {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  dataUrl: string;
};

export type ReservationDraft = Omit<Reservation, 'id'>;

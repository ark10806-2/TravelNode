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
};

export type ReservationDraft = Omit<Reservation, 'id'>;

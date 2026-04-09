export interface SocialFriend {
  managerId: string;
  clubName: string;
  addedAtIso: string;
}

export interface IncomingFriendRequest {
  id: string;
  fromManagerId: string;
  fromClubName: string;
  sentAtIso: string;
}

export interface OutgoingFriendRequest {
  id: string;
  toManagerId: string;
  toClubName: string;
  sentAtIso: string;
}

export interface SocialState {
  friends: SocialFriend[];
  incoming: IncomingFriendRequest[];
  outgoing: OutgoingFriendRequest[];
}

export function createInitialSocialState(): SocialState {
  return {
    friends: [],
    incoming: [
      {
        id: 'fr-seed-wolves',
        fromManagerId: 'mgr_wolves',
        fromClubName: 'WOLVES',
        sentAtIso: new Date().toISOString(),
      },
    ],
    outgoing: [],
  };
}

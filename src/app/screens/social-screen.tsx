import { FormEvent, useEffect, useMemo, useState } from "react";
import { MessageCircle, Search, Send, UserCheck, UserMinus, UserPlus } from "lucide-react";
import { EmptyState } from "../components/common";
import { initials, relativeTime } from "../helpers";
import type { ChatMessage, FollowProfile, Friend } from "../types";

type SocialScreenProps = {
  currentUserId: string;
  friends: Friend[];
  profiles: FollowProfile[];
  messages: ChatMessage[];
  onFollow: (username: string) => void;
  onUnfollow: (profileId: string) => void;
  onSendMessage: (friendId: string, body: string) => void;
};

export function SocialScreen({ currentUserId, friends, profiles, messages, onFollow, onUnfollow, onSendMessage }: SocialScreenProps) {
  const [username, setUsername] = useState("");
  const [selectedFriendId, setSelectedFriendId] = useState(friends[0]?.id || "");
  const [message, setMessage] = useState("");

  const selectedFriend = friends.find((friend) => friend.id === selectedFriendId) || friends[0] || null;
  useEffect(() => {
    if (!selectedFriendId && friends[0]?.id) setSelectedFriendId(friends[0].id);
    if (selectedFriendId && !friends.some((friend) => friend.id === selectedFriendId)) setSelectedFriendId(friends[0]?.id || "");
  }, [friends, selectedFriendId]);
  const visibleProfiles = useMemo(() => {
    const term = username.replace(/^@/, "").toLowerCase().trim();
    if (!term) return profiles.slice(0, 8);
    return profiles.filter((profile) => profile.username.toLowerCase().includes(term) || profile.name.toLowerCase().includes(term)).slice(0, 8);
  }, [profiles, username]);

  const conversation = selectedFriend
    ? messages.filter(
        (item) =>
          (item.senderId === currentUserId && item.receiverId === selectedFriend.id) ||
          (item.senderId === selectedFriend.id && item.receiverId === currentUserId),
      )
    : [];

  function submitFollow(event: FormEvent) {
    event.preventDefault();
    onFollow(username);
    setUsername("");
  }

  function submitMessage(event: FormEvent) {
    event.preventDefault();
    if (!selectedFriend || !message.trim()) return;
    onSendMessage(selectedFriend.id, message);
    setMessage("");
  }

  return (
    <section className="screen with-nav">
      <header className="page-header">
        <p className="eyebrow">Amigos</p>
        <h1>Chat com seguidores mutuos</h1>
      </header>

      <form className="friend-search" onSubmit={submitFollow}>
        <Search size={18} />
        <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Seguir por @usuario" />
        <button aria-label="Seguir usuario">
          <UserPlus size={18} />
        </button>
      </form>

      <div className="follow-list">
        {visibleProfiles.map((profile) => (
          <article className="follow-card" key={profile.id}>
            {profile.avatarUrl ? <img src={profile.avatarUrl} alt={profile.name} /> : <span>{profile.avatar}</span>}
            <div>
              <strong>{profile.name}</strong>
              <small>@{profile.username}</small>
            </div>
            {profile.followedByMe ? (
              <button className="mini-button quiet" onClick={() => onUnfollow(profile.id)} aria-label={`Deixar de seguir ${profile.username}`}>
                <UserMinus size={16} />
              </button>
            ) : (
              <button className="mini-button" onClick={() => onFollow(profile.username)} aria-label={`Seguir ${profile.username}`}>
                <UserPlus size={16} />
              </button>
            )}
            {profile.isFriend && <UserCheck className="follow-check" size={16} />}
          </article>
        ))}
      </div>

      <div className="section-title compact-title">
        <h2>Chats</h2>
        <span>{friends.length} amigos</span>
      </div>

      {friends.length === 0 ? (
        <EmptyState title="Nenhum chat liberado" text="Siga pessoas pelo username. Quando ela seguir voce tambem, o chat aparece aqui." />
      ) : (
        <>
          <div className="chat-friend-strip">
            {friends.map((friend) => (
              <button
                key={friend.id}
                className={selectedFriend?.id === friend.id ? "active" : ""}
                onClick={() => setSelectedFriendId(friend.id)}
                aria-label={`Abrir chat com ${friend.name}`}
              >
                {friend.avatarUrl ? <img src={friend.avatarUrl} alt="" /> : <span>{friend.avatar || initials(friend.name)}</span>}
                <small>@{friend.username}</small>
              </button>
            ))}
          </div>

          <article className="chat-panel">
            <header>
              <MessageCircle size={18} />
              <div>
                <strong>{selectedFriend?.name}</strong>
                <small>@{selectedFriend?.username}</small>
              </div>
            </header>

            <div className="message-list">
              {conversation.length === 0 ? (
                <p className="empty-chat">Comece a conversa.</p>
              ) : (
                conversation.map((item) => (
                  <div className={item.senderId === currentUserId ? "message-bubble mine" : "message-bubble"} key={item.id}>
                    <span>{item.body}</span>
                    <small>{relativeTime(item.createdAt)}</small>
                  </div>
                ))
              )}
            </div>

            <form className="message-form" onSubmit={submitMessage}>
              <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Mensagem" />
              <button aria-label="Enviar mensagem">
                <Send size={18} />
              </button>
            </form>
          </article>
        </>
      )}
    </section>
  );
}

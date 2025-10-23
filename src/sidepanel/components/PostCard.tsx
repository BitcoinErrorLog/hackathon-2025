import { NexusPost } from '../../utils/nexus-client';

interface PostCardProps {
  post: NexusPost;
}

function PostCard({ post }: PostCardProps) {
  // Handle nested details structure from Nexus
  const details = post.details || {
    id: post.id || '',
    author: post.author_id || '',
    content: post.content || '',
    kind: post.kind || 'short',
    uri: post.uri || '',
    indexed_at: post.indexed_at || 0,
    attachments: post.attachments || []
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const formatAuthorId = (authorId: string) => {
    if (authorId.length <= 16) return authorId;
    return `${authorId.substring(0, 8)}...${authorId.substring(authorId.length - 8)}`;
  };

  const getKindIcon = (kind: string) => {
    switch (kind) {
      case 'link': return '🔗';
      case 'short': return '💬';
      case 'long': return '📄';
      case 'image': return '🖼️';
      case 'video': return '🎥';
      case 'file': return '📎';
      default: return '📝';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition">
      {/* Author */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          {post.author?.image ? (
            <img 
              src={post.author.image} 
              alt={post.author.name || 'User'} 
              className="w-10 h-10 rounded-full mr-3"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold mr-3">
              {post.author?.name?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          <div>
            <p className="font-semibold text-sm text-gray-800">
              {post.author?.name || formatAuthorId(details.author)}
            </p>
            <p className="text-xs text-gray-500">
              {formatDate(details.indexed_at)}
            </p>
          </div>
        </div>
        <span className="text-xl" title={details.kind}>
          {getKindIcon(details.kind)}
        </span>
      </div>

      {/* Content */}
      <div className="mb-3">
        <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
          {details.content}
        </p>
      </div>

      {/* Embed/Repost */}
      {post.embed && (
        <div className="bg-gray-50 border border-gray-200 rounded p-3 mb-3">
          <p className="text-xs text-gray-500 mb-1">
            {getKindIcon(post.embed.kind)} Reposted:
          </p>
          <p className="text-xs text-gray-700 font-mono break-all">
            {post.embed.uri}
          </p>
        </div>
      )}

      {/* Attachments */}
      {details.attachments && details.attachments.length > 0 && (
        <div className="space-y-2 mb-3">
          {details.attachments.map((attachment, idx) => (
            <div 
              key={idx}
              className="bg-blue-50 border border-blue-200 rounded p-2"
            >
              <p className="text-xs text-blue-700 break-all">
                📎 {attachment}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
        <a
          href={details.uri}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-blue-600 transition"
        >
          View on Pubky →
        </a>
        <span className="font-mono text-[10px]">
          {formatAuthorId(details.id)}
        </span>
      </div>
    </div>
  );
}

export default PostCard;


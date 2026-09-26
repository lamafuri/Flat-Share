// Membership checks that work whether or not `admin` / `members.user` are populated.

export const getAdminId = (group) => {
  return group.admin?._id ? group.admin._id.toString() : group.admin.toString();
};

export const isMember = (group, userId) => {
  const uid = userId.toString();
  return group.members.some(m => {
    const memberId = m.user?._id ? m.user._id.toString() : m.user.toString();
    return memberId === uid;
  }) || getAdminId(group) === uid;
};

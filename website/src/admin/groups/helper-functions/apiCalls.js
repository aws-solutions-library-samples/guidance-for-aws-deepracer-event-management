import { API } from 'aws-amplify';
import { addUserToGroup, deleteUserFromGroup } from '../../../graphql/mutations';
import { getGroupMembers } from '../../../graphql/queries';

export const getGroupMembersQuery = async (groupName) => {
  const responseGetGroups = await API.graphql({
    query: getGroupMembers,
    variables: {
      GroupName: groupName,
    },
  });
  const groupUsers = responseGetGroups.data.getGroupMembers;
  console.info(groupUsers);

  return groupUsers;
};
export const addUserToGroupMutation = async (username, groupName) => {
  const response = await API.graphql({
    query: addUserToGroup,
    variables: {
      GroupName: groupName,
      Username: username,
    },
  });
  console.info(response);
};

export const removeUserFromGroupMutation = async (username, groupName) => {
  const response = await API.graphql({
    query: deleteUserFromGroup,
    variables: {
      GroupName: groupName,
      Username: username,
    },
  });
  console.info(response);
};

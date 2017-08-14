import cloneDeep from 'lodash/cloneDeep';

export default (userDocument) => {
  const user = cloneDeep(userDocument);
  user._id = user._id.toHexString();
  delete user.password;
  return user;
};

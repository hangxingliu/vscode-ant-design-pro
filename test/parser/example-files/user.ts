//@ts-ignore
import { query as queryUsers, queryCurrent } from '@/services/user';

type Action = { payload: any };

export default {
  namespace: 'user',

  state: {
    list: [],
    currentUser: {},
  },

  effects: {
    *fetch(_: any, { call, put }) {
      const response = yield call(queryUsers);
      yield put({
        type: 'save',
        payload: response,
      });
    },
    async fetchCurrent(_: any, { call, put }) {
      const response = await call(queryCurrent);
      await put({
        type: 'saveCurrentUser',
        payload: response,
      });
    },
  },

  reducers: {
    save(state: any, action: Action) {
      return {
        ...state,
        list: action.payload,
      };
    },
    saveCurrentUser(state: any, action: Action) {
      return {
        ...state,
        currentUser: action.payload || {},
      };
    },
    changeNotifyCount(state: any, action: Action) {
      return {
        ...state,
        currentUser: {
          ...state.currentUser,
          notifyCount: action.payload,
        },
      };
    },
  },
};

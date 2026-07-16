import { combineReducers } from 'redux';

import userReducer from './user/user.reducer';
import propertyReducer from './property/property.reducer';
import unitReducer from './unit/unit.reducer';
import maintenanceReducer from './maintenance/maintenance.reducer';
import tenantReducer from './tenant/tenant.reducer';
import leaseReducer from './lease/lease.reducer';
import stylesReducer from './styles/styles.reducer';
import dashboardReducer from './dashboard/dashboard.reducer';
import rentCollectionReducer from './rent-collection/rent-collection.reducer';
import householdReducer from './household/household.reducer';
import paymentReducer from './payment/payment.reducer';
import expenseReducer from './expense/expense.reducer';
import recurringExpenseReducer from './recurring-expense/recurring-expense.reducer';
import futureExpenseReducer from './future-expense/future-expense.reducer';
import conversationReducer from './conversation/conversation.reducer';
import messageReducer from './message/message.reducer';
import vendorReducer from './vendor/vendor.reducer';
import clientReducer from './client/client.reducer';
import listingReducer from './listing/listing.reducer';
import taskReducer from './task/task.reducer';

const appReducer = combineReducers({
  user: userReducer,
  property: propertyReducer,
  unit: unitReducer,
  household: householdReducer,
  dashboard: dashboardReducer,
  maintenance: maintenanceReducer,
  tenant: tenantReducer,
  lease: leaseReducer,
  rentCollection: rentCollectionReducer,
  payment: paymentReducer,
  expense: expenseReducer,
  recurringExpense: recurringExpenseReducer,
  futureExpense: futureExpenseReducer,
  conversation: conversationReducer,
  message: messageReducer,
  vendor: vendorReducer,
  client: clientReducer,
  listing: listingReducer,
  task: taskReducer,
  styles: stylesReducer
});

// Root reducer that resets state on logout
export const rootReducer = (state, action) => {
  // When LOGOUT action is dispatched, reset all state to undefined
  // This will reinitialize all reducers with their initial state
  // The user reducer handles @auth/LOGOUT and sets loading: false
 // if (action.type === '@auth/LOGOUT') {
  //  state = undefined;
 // }
  
  return appReducer(state, action);
};

import { registerRootComponent } from 'expo';

// Must be imported before the app mounts: iOS can launch the bundle headless just
// to deliver background location, and the task has to be registered by then.
import './src/location/backgroundRunTask';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * true quando o app roda dentro do Expo Go (e não em um development build).
 * No Expo Go: não há TaskManager no Android, sons/permissões personalizados do app não existem
 * e o alarme com o app fechado não é confiável — por isso essas partes são desativadas ali.
 */
export const emExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

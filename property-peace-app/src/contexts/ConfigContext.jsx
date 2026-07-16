import PropTypes from 'prop-types';
import { createContext, useCallback, useEffect, useMemo, startTransition } from 'react';

// project imports
import defaultConfig, { MenuOrientation } from 'config';
import useLocalStorage from 'hooks/useLocalStorage';

// initial state
const initialState = {
  ...defaultConfig,
  onChangeContainer: () => {},
  onChangeLocalization: () => {},
  onChangeMode: () => {},
  onChangePresetColor: () => {},
  onChangeDirection: () => {},
  onChangeMiniDrawer: () => {},
  onChangeMenuOrientation: () => {},
  onChangeFontFamily: () => {}
};

// ==============================|| CONFIG CONTEXT & PROVIDER ||============================== //

const ConfigContext = createContext(initialState);

function ConfigProvider({ children }) {
  const [storedConfig, setConfig] = useLocalStorage('mantis-react-ts-config', initialState);

  // Normalize config to ensure i18n defaults to 'en'
  const validLanguages = ['en', 'fr', 'ro', 'zh'];
  const config = useMemo(
    () => ({
      ...storedConfig,
      i18n: storedConfig.i18n && validLanguages.includes(storedConfig.i18n) ? storedConfig.i18n : 'en'
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storedConfig]
  );

  // Update stored config if i18n is missing or invalid
  useEffect(() => {
    if (!storedConfig.i18n || !validLanguages.includes(storedConfig.i18n)) {
      setConfig((prev) => ({ ...prev, i18n: 'en' }));
    }
  }, [storedConfig.i18n, setConfig]);

  const onChangeContainer = useCallback(
    (container) => {
      setConfig((prev) => ({ ...prev, container }));
    },
    [setConfig]
  );

  const onChangeLocalization = useCallback(
    (lang) => {
      setConfig((prev) => ({ ...prev, i18n: lang }));
    },
    [setConfig]
  );

  const onChangeMode = useCallback(
    (mode) => {
      startTransition(() => {
        setConfig((prev) => ({ ...prev, mode }));
      });
    },
    [setConfig]
  );

  const onChangePresetColor = useCallback(
    (theme) => {
      setConfig((prev) => ({ ...prev, presetColor: theme }));
    },
    [setConfig]
  );

  const onChangeDirection = useCallback(
    (direction) => {
      setConfig((prev) => ({ ...prev, themeDirection: direction }));
    },
    [setConfig]
  );

  const onChangeMiniDrawer = useCallback(
    (miniDrawer) => {
      setConfig((prev) => ({ ...prev, menuOrientation: MenuOrientation.VERTICAL, miniDrawer }));
    },
    [setConfig]
  );

  const onChangeMenuOrientation = useCallback(
    (layout) => {
      setConfig((prev) => ({
        ...prev,
        menuOrientation: layout,
        ...(layout === MenuOrientation.VERTICAL && { miniDrawer: false })
      }));
    },
    [setConfig]
  );

  const onChangeFontFamily = useCallback(
    (fontFamily) => {
      setConfig((prev) => ({ ...prev, fontFamily }));
    },
    [setConfig]
  );

  const contextValue = useMemo(
    () => ({
      ...config,
      onChangeContainer,
      onChangeLocalization,
      onChangeMode,
      onChangePresetColor,
      onChangeDirection,
      onChangeMiniDrawer,
      onChangeMenuOrientation,
      onChangeFontFamily
    }),
    [config, onChangeContainer, onChangeLocalization, onChangeMode, onChangePresetColor, onChangeDirection, onChangeMiniDrawer, onChangeMenuOrientation, onChangeFontFamily]
  );

  return (
    <ConfigContext value={contextValue}>
      {children}
    </ConfigContext>
  );
}

export { ConfigProvider, ConfigContext };

ConfigProvider.propTypes = { children: PropTypes.node };

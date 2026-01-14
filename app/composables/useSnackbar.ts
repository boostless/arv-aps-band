export const useSnackbar = () => {
    // Global state specific to Nuxt
    const show = useState('snackbar_show', () => false);
    const message = useState('snackbar_message', () => '');
    const color = useState('snackbar_color', () => 'success'); // success, error, warning, info

    /**
     * Show a toast notification
     * @param msg The text to display
     * @param type 'success' | 'error' | 'info' | 'warning'
     */
    const trigger = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
        message.value = msg;
        color.value = type;
        show.value = true;
    };

    return {
        show,
        message,
        color,
        trigger,
    };
};
import { StyleSheet } from "react-native"
import { theme } from "./theme"

export const fabStyles = StyleSheet.create({
    style: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 60,
        height: 60,
        position: 'absolute',
        bottom: 10,
        right: 10,
        backgroundColor: theme.colors.white,
        borderRadius: 100,
        elevation: 5,
        shadowColor: theme.colors.primary,
        shadowOpacity: 0.4,
        shadowRadius: 5,
        shadowOffset: {width: 0, height: 2}
    }
})
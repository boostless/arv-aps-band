import currency from 'currency.js'

export default function EUR(amount: number | string) {
    return currency(amount, {
        symbol: '€',
        separator: '.',
        decimal: ',',
        precision: 2,
        pattern: '# !',
        fromCents: true,
    })
}
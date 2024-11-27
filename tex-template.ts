import { BigNumber } from "bignumber.js"
import { exec } from "child_process"
import HandleBars from "handlebars"
import assert from "assert"
import fs from "fs"

const cpiSince15: BigNumber[] = [ '1.7', '2.0', '2.3', '3.4', '3.5', '2.7', '1.9', '3.0', '2.5', '2.3' ].map (x => (new BigNumber(x)).dividedBy ('100'))
assert (cpiSince15.length === 10)
const currentCpi = cpiSince15[cpiSince15.length - 1]
const maxIncrease = currentCpi.multipliedBy ('3')

const template = fs.readFileSync ('./template.tex', 'utf8')
const tenantData = fs.readFileSync ('./tenant-data.csv', 'utf8').split ('\n').slice (1).map (row => row.split (','))
const handlebarsTemplate = HandleBars.compile (template)


class RentIncrease {
    public amount: BigNumber
    public newRent: BigNumber
    public applyBanked: boolean
    public percentage: string

    constructor (baseRent: BigNumber, currentRent: BigNumber, cpiRent: BigNumber, bankedRent: BigNumber) {
        this.applyBanked = bankedRent.isGreaterThan (cpiRent)
        this.newRent = this.applyBanked ? bankedRent : cpiRent
        this.amount = this.newRent.minus (currentRent)
        this.percentage = this.amount.div (currentRent).multipliedBy ('100').toFixed (1)
    }
}

class Tenant {
    public name: string
    public unit: string
    public leaseStart: Date
    public baseRent: BigNumber
    public currentRent: BigNumber

    constructor (row: string[]) {
        this.name = row[0]
        this.unit = row[1]
        this.leaseStart = new Date (row[2])
        this.baseRent = new BigNumber (row[3])
        this.currentRent = new BigNumber (row[4])
    }
}

class TemplateData {
    public name: string
    public unit: string
    public percentage: string
    public amount: string
    public oldRent: string
    public newRent: string
    public applyBanked: boolean
    public maxBanked: boolean

    constructor (tenant: Tenant, rentIncrease: RentIncrease) {
        this.name = tenant.name
        this.unit = tenant.unit
        this.percentage = rentIncrease.percentage
        this.maxBanked = rentIncrease.percentage === maxIncrease.multipliedBy ('100').toFixed (1)
        this.oldRent = tenant.currentRent.toFixed (2)
        this.amount = rentIncrease.amount.toFixed (2)
        this.newRent = rentIncrease.newRent.toFixed (2)
        this.applyBanked = rentIncrease.applyBanked
        const [ oldRent, amount, newRent ] = [ new BigNumber (this.oldRent), new BigNumber (this.amount), new BigNumber(this.newRent) ]
        assert (oldRent.plus (amount).isEqualTo (newRent) )
    }
}

function calculateRentIncrease(leaseStart: Date, baseRent: BigNumber, currentRent: BigNumber): RentIncrease {
    const year = leaseStart.getFullYear ()
    assert (year < 2024)
    const month = leaseStart.getMonth () + 1
    const effectiveDate = new Date ('01/01/2025')
    const millisecondDiff = effectiveDate.getTime () - leaseStart.getTime ()
    const years = Math.min (Math.floor (millisecondDiff / (1000 * 60 * 60 * 24 * 365)), 10)
    let startIndex = Math.max (year - 2014, 0)
    if ((month < 8) && (startIndex > 0)) {
        startIndex -= 1
    }
    const currentCpi = cpiSince15[cpiSince15.length - 1]
    const percentageIncrease = cpiSince15.slice (startIndex, startIndex + years).map (x => x.plus ('1')).reduce ((x, y) => x.multipliedBy (y), new BigNumber ('1'))
    const bankedRent = baseRent.multipliedBy (percentageIncrease)
    const cappedRent = currentRent.multipliedBy (maxIncrease.plus ('1'))
    const cpiRent = currentRent.multipliedBy (currentCpi.plus ('1'))
    const effectiveBankedRent = BigNumber.min (bankedRent, cappedRent)
    return new RentIncrease (baseRent, currentRent, cpiRent, effectiveBankedRent)
}

function main () {
    let totalAmount = new BigNumber ('0')
    for (const data of tenantData) {
        if (data[0].length === 0) {
            break
        }
        const tenant = new Tenant (data)
        const rentIncrease = calculateRentIncrease (tenant.leaseStart, tenant.baseRent, tenant.currentRent)
        totalAmount = rentIncrease.amount.plus (totalAmount)
        const templateData = new TemplateData (tenant, rentIncrease)
        const output = handlebarsTemplate ( { ...templateData })
        const path = `./templates/${tenant.unit}.tex`
        fs.writeFile (path, output, () => { exec (`pdflatex -output-directory ./output ${path}`, (error, stdout, stderr) => {
            fs.unlinkSync (`./output/${tenant.unit}.out`)
            fs.unlinkSync (`./output/${tenant.unit}.log`)
            fs.unlinkSync (`./output/${tenant.unit}.aux`)
        }) } )
    }
    console.log ('Increased the yearly income by ' + totalAmount.multipliedBy ('12').toString ())
}

main ()

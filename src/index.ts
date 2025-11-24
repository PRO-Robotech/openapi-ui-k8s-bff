import express, { Express } from 'express'
import bodyParser from 'body-parser'
import dotenv from 'dotenv'
import expressWs from 'express-ws'
import healthcheck from 'express-healthcheck'
import promMid from 'express-prometheus-middleware'
import cors from 'cors'
import winston from 'winston'
import expressWinston from 'express-winston'
// const apicache = require('apicache')
import { BASEPREFIX } from 'src/constants/envs'
import { getDerefedSwagger } from 'src/endpoints/swagger'
import { prepareFormProps, getYamlValuesByFromValues, getFormValuesByYaml } from 'src/endpoints/forms'
import { prepareTableProps } from 'src/endpoints/tables'
import {
  checkIfApiNamespaceScoped,
  checkIfBuiltInNamespaceScoped,
  filterIfApiNamespaceScoped,
  filterIfBuiltInNamespaceScoped,
} from 'src/endpoints/scopes'
import {
  terminalPodWebSocket,
  terminalNodeWebSocket,
  podLogsWebSocket,
  podLogsNonWsWebSocket,
} from 'src/endpoints/terminal'
import { getKinds } from 'src/endpoints/search'
import { getResourceVerbs } from 'src/endpoints/verbs'
import { getEvents, eventsWebSocket } from 'src/endpoints/events'
import { listWatchWebSocket } from 'src/endpoints/listThenWatch'
import { getClusterSwagger } from './cache'

dotenv.config()

// const cache = apicache.middleware

const nonWsApp: Express = express()
const { app } = expressWs(nonWsApp)
const port = process.env.PORT || 3000

app.use('/healthcheck', healthcheck())
app.use(
  promMid({
    metricsPath: '/metrics',
  }),
)

if (process.env.SWAGGER === 'TRUE') {
  const swaggerUi = require('swagger-ui-express')
  const swaggerDocument = require('./swagger/swagger-output.json')
  app.use('/swagger/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDocument))
}

if (process.env.LOGGER === 'TRUE') {
  app.use(
    expressWinston.logger({
      transports: [new winston.transports.Console()],
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        winston.format.json(),
      ),
      expressFormat: true,
      colorize: false,
      requestWhitelist: process.env.LOGGER_WITH_HEADERS === 'TRUE' ? ['body', 'headers'] : ['body'],
      responseWhitelist: ['body'],
    }),
  )
}

app.use(bodyParser.json({ limit: '50mb' }))

const FRONTEND_URL_FOR_CORS = process.env.FRONTEND_URL_FOR_CORS || 'http://localhost:3000'

app.use(
  cors({
    origin: [FRONTEND_URL_FOR_CORS],
  }),
)

await getClusterSwagger()

/* swagger */
// app.get('/openapi-bff/swagger/swagger/:cluster', cache('5 minutes'), getDerefedSwagger)
app.get(`${BASEPREFIX}/openapi-bff/swagger/swagger/:cluster`, getDerefedSwagger)

/* forms */
app.post(`${BASEPREFIX}/openapi-bff/forms/formSync/getYamlValuesByFromValues`, getYamlValuesByFromValues)
app.post(`${BASEPREFIX}/openapi-bff/forms/formSync/getFormValuesByYaml`, getFormValuesByYaml)
app.post(`${BASEPREFIX}/openapi-bff/forms/formPrepare/prepareFormProps`, prepareFormProps)

/* tables */
app.post(`${BASEPREFIX}/openapi-bff/tables/tablePrepare/prepareTableProps`, prepareTableProps)

/* scopes */
app.post(`${BASEPREFIX}/openapi-bff/scopes/checkScopes/checkIfApiNamespaceScoped`, checkIfApiNamespaceScoped)
app.post(`${BASEPREFIX}/openapi-bff/scopes/checkScopes/checkIfBuiltInNamespaceScoped`, checkIfBuiltInNamespaceScoped)
app.post(`${BASEPREFIX}/openapi-bff/scopes/filterScopes/filterIfApiNamespaceScoped`, filterIfApiNamespaceScoped)
app.post(`${BASEPREFIX}/openapi-bff/scopes/filterScopes/filterIfBuiltInNamespaceScoped`, filterIfBuiltInNamespaceScoped)

/* search */
/* kinds */
app.get(`${BASEPREFIX}/openapi-bff/search/kinds/getKinds`, getKinds)

/* verbs */
app.get(`${BASEPREFIX}/openapi-bff/verbs/getResourceVerbs`, getResourceVerbs)

/* terminal */
app.ws(`${BASEPREFIX}/openapi-bff-ws/terminal/terminalPod/terminalPod`, terminalPodWebSocket)
app.ws(`${BASEPREFIX}/openapi-bff-ws/terminal/terminalNode/terminalNode`, terminalNodeWebSocket)
app.ws(`${BASEPREFIX}/openapi-bff-ws/terminal/podLogs/podLogs`, podLogsWebSocket)
app.ws(`${BASEPREFIX}/openapi-bff-ws/terminal/podLogs/podLogsNonWs`, podLogsNonWsWebSocket)

/* events */
/* events: list */
app.get(`${BASEPREFIX}/openapi-bff/evets/events/getKinds`, getEvents)

/* events: ws */
app.ws(`${BASEPREFIX}/openapi-bff-ws/events/eventsWs`, eventsWebSocket)

/* list-then-watch: ws */
app.ws(`${BASEPREFIX}/openapi-bff-ws/listThenWatch/listWatchWs`, listWatchWebSocket)

app.listen(port, () => {
  console.log(`[server]: Server is running at port: ${port}`)
})
